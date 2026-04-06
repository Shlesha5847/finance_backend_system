const { MongoMemoryServer } = require("mongodb-memory-server");
const { spawn } = require("child_process");

const TEST_PORT = String(process.env.TEST_PORT || 5055);
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const REQUEST_TIMEOUT_MS = 10000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const request = async (method, path, body, token) => {
  const headers = {
    "Content-Type": "application/json"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_error) {
    json = { raw: text };
  }

  return {
    status: response.status,
    body: json
  };
};

const waitForServer = async () => {
  for (let i = 0; i < 60; i += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(`${BASE_URL}/`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        return true;
      }
    } catch (_error) {}
    await wait(500);
  }
  return false;
};

const results = [];
const recordResult = (name, passed, detail = "") => {
  results.push({ name, passed, detail });
};

const expectStatus = (name, res, expectedStatus, extraCheck) => {
  const statusOk = res.status === expectedStatus;
  let checkOk = true;
  let detail = `expected ${expectedStatus}, got ${res.status}`;

  if (statusOk && typeof extraCheck === "function") {
    try {
      checkOk = !!extraCheck(res.body);
      if (!checkOk) {
        detail = "payload validation failed";
      }
    } catch (error) {
      checkOk = false;
      detail = `payload check error: ${error.message}`;
    }
  }

  recordResult(name, statusOk && checkOk, statusOk && checkOk ? "ok" : detail);
};

const printSummary = () => {
  console.log("\nE2E Test Results");
  console.log("=".repeat(60));
  results.forEach((r) => {
    console.log(`${r.passed ? "PASS" : "FAIL"} | ${r.name} | ${r.detail}`);
  });
  console.log("=".repeat(60));
  const passedCount = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`Passed: ${passedCount}/${total}`);
  return passedCount === total;
};

const run = async () => {
  let mongoServer;
  let serverProc;

  try {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri("finance_api_test");

    serverProc = spawn("node", ["server.js"], {
      env: {
        ...process.env,
        PORT: TEST_PORT,
        MONGO_URI: mongoUri,
        JWT_SECRET: "test_secret",
        JWT_EXPIRES_IN: "1d"
      },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false
    });

    serverProc.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
    serverProc.stderr.on("data", (chunk) => process.stderr.write(`[server-err] ${chunk}`));

    const serverReady = await waitForServer();
    if (!serverReady) {
      throw new Error("Server did not start in time");
    }

    const invalidRoleRes = await request("POST", "/api/auth/register", {
      name: "Bad Role",
      email: "badrole@example.com",
      password: "password123",
      role: "owner"
    });
    expectStatus("Register rejects invalid role", invalidRoleRes, 400);

    const adminRegisterRes = await request("POST", "/api/auth/register", {
      name: "Admin User",
      email: "admin@example.com",
      password: "password123",
      role: "admin"
    });
    expectStatus("Register admin", adminRegisterRes, 201, (b) => b?.data?.user?.role === "admin");

    const analystRegisterRes = await request("POST", "/api/auth/register", {
      name: "Analyst User",
      email: "analyst@example.com",
      password: "password123",
      role: "analyst"
    });
    expectStatus("Register analyst", analystRegisterRes, 201, (b) => b?.data?.user?.role === "analyst");

    const viewerRegisterRes = await request("POST", "/api/auth/register", {
      name: "Viewer User",
      email: "viewer@example.com",
      password: "password123",
      role: "viewer"
    });
    expectStatus("Register viewer", viewerRegisterRes, 201, (b) => b?.data?.user?.role === "viewer");

    const duplicateRegisterRes = await request("POST", "/api/auth/register", {
      name: "Admin User",
      email: "admin@example.com",
      password: "password123",
      role: "admin"
    });
    expectStatus("Register duplicate email rejected", duplicateRegisterRes, 400);

    const adminLoginRes = await request("POST", "/api/auth/login", {
      email: "admin@example.com",
      password: "password123"
    });
    expectStatus("Login admin", adminLoginRes, 200, (b) => !!b?.data?.token);

    const analystLoginRes = await request("POST", "/api/auth/login", {
      email: "analyst@example.com",
      password: "password123"
    });
    expectStatus("Login analyst", analystLoginRes, 200, (b) => !!b?.data?.token);

    const viewerLoginRes = await request("POST", "/api/auth/login", {
      email: "viewer@example.com",
      password: "password123"
    });
    expectStatus("Login viewer", viewerLoginRes, 200, (b) => !!b?.data?.token);

    const badLoginRes = await request("POST", "/api/auth/login", {
      email: "admin@example.com",
      password: "wrongpass"
    });
    expectStatus("Login invalid credentials rejected", badLoginRes, 401);

    const adminToken = adminLoginRes.body?.data?.token;
    const analystToken = analystLoginRes.body?.data?.token;
    const viewerToken = viewerLoginRes.body?.data?.token;

    const noTokenGetRes = await request("GET", "/api/finance");
    expectStatus("GET /api/finance without token rejected", noTokenGetRes, 401);

    const badTokenGetRes = await request("GET", "/api/finance", null, "bad.token.value");
    expectStatus("GET /api/finance with invalid token rejected", badTokenGetRes, 401);

    const viewerCreateRes = await request(
      "POST",
      "/api/finance",
      {
        title: "Viewer Attempt",
        amount: 100,
        type: "income",
        category: "misc",
        date: "2024-01-01"
      },
      viewerToken
    );
    expectStatus("Viewer cannot create finance record", viewerCreateRes, 403);

    const adminNegativeCreateRes = await request(
      "POST",
      "/api/finance",
      {
        title: "Invalid Amount",
        amount: -50,
        type: "expense",
        category: "test",
        date: "2024-01-02"
      },
      adminToken
    );
    expectStatus("Admin create with negative amount rejected", adminNegativeCreateRes, 400);

    const payloads = [
      { title: "Salary Jan", amount: 5000, type: "income", category: "job", date: "2024-01-05" },
      { title: "Groceries", amount: 300, type: "expense", category: "food", date: "2024-01-06" },
      { title: "Freelance", amount: 1200, type: "income", category: "side", date: "2024-01-07" },
      { title: "Rent", amount: 1500, type: "expense", category: "housing", date: "2024-01-08" }
    ];

    const createdIds = [];
    for (const p of payloads) {
      const createRes = await request("POST", "/api/finance", p, adminToken);
      expectStatus(`Admin create finance: ${p.title}`, createRes, 201, (b) => !!b?.data?._id);
      if (createRes.status === 201 && createRes.body?.data?._id) {
        createdIds.push(createRes.body.data._id);
      }
    }

    const viewerReadRes = await request("GET", "/api/finance", null, viewerToken);
    expectStatus(
      "Viewer can read finance records",
      viewerReadRes,
      200,
      (b) => Array.isArray(b?.data?.records) && b.data.records.length >= 4
    );

    const filterTypeRes = await request("GET", "/api/finance?type=income", null, viewerToken);
    expectStatus(
      "Filter by type=income works",
      filterTypeRes,
      200,
      (b) => b?.data?.records?.every((r) => r.type === "income")
    );

    const filterCategoryRes = await request("GET", "/api/finance?category=food", null, viewerToken);
    expectStatus(
      "Filter by category works",
      filterCategoryRes,
      200,
      (b) => b?.data?.records?.length === 1 && b.data.records[0].category.toLowerCase() === "food"
    );

    const dateRangeRes = await request(
      "GET",
      "/api/finance?startDate=2024-01-06&endDate=2024-01-08",
      null,
      viewerToken
    );
    expectStatus("Filter by date range works", dateRangeRes, 200, (b) => b?.data?.records?.length === 3);

    const sortAmountAscRes = await request(
      "GET",
      "/api/finance?sortBy=amount&order=asc",
      null,
      viewerToken
    );
    expectStatus("Sort by amount asc works", sortAmountAscRes, 200, (b) => {
      const amounts = (b?.data?.records || []).map((r) => r.amount);
      return amounts.every((v, i) => i === 0 || amounts[i - 1] <= v);
    });

    const paginationRes = await request("GET", "/api/finance?limit=2&page=2", null, viewerToken);
    expectStatus(
      "Pagination limit=2 page=2 works",
      paginationRes,
      200,
      (b) => b?.data?.records?.length === 2 && b?.data?.pagination?.currentPage === 2
    );

    const invalidTypeFilterRes = await request("GET", "/api/finance?type=bonus", null, viewerToken);
    expectStatus("Invalid type filter rejected", invalidTypeFilterRes, 400);

    const invalidSortRes = await request("GET", "/api/finance?sortBy=title", null, viewerToken);
    expectStatus("Invalid sortBy rejected", invalidSortRes, 400);

    const summaryAnalystRes = await request("GET", "/api/finance/summary", null, analystToken);
    expectStatus(
      "Analyst can access summary",
      summaryAnalystRes,
      200,
      (b) => b?.data?.totalIncome === 6200 && b?.data?.totalExpense === 1800
    );

    const summaryViewerRes = await request("GET", "/api/finance/summary", null, viewerToken);
    expectStatus("Viewer cannot access summary", summaryViewerRes, 403);

    if (createdIds.length > 0) {
      const updateRes = await request(
        "PUT",
        `/api/finance/${createdIds[0]}`,
        { amount: 5500, category: "primary-job" },
        adminToken
      );
      expectStatus(
        "Admin can update finance record",
        updateRes,
        200,
        (b) => b?.data?.amount === 5500 && b?.data?.category === "primary-job"
      );
    } else {
      recordResult("Admin can update finance record", false, "missing created records");
    }

    if (createdIds.length > 1) {
      const deleteRes = await request("DELETE", `/api/finance/${createdIds[1]}`, null, adminToken);
      expectStatus("Admin can delete finance record", deleteRes, 200);
    } else {
      recordResult("Admin can delete finance record", false, "missing created records");
    }

    const missingRecordDeleteRes = await request(
      "DELETE",
      "/api/finance/64eacb1f7f3f000000000001",
      null,
      adminToken
    );
    expectStatus("Delete missing record returns 404", missingRecordDeleteRes, 404);

    const ok = printSummary();
    process.exitCode = ok ? 0 : 1;
  } catch (error) {
    console.error("\nE2E run failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (serverProc) {
      serverProc.kill();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
};

const SUITE_TIMEOUT_MS = 5 * 60 * 1000;

Promise.race([
  run(),
  (async () => {
    await wait(SUITE_TIMEOUT_MS);
    throw new Error(`E2E suite exceeded ${SUITE_TIMEOUT_MS}ms`);
  })()
]).catch((error) => {
  console.error("\nE2E run failed:", error.message);
  process.exitCode = 1;
});
