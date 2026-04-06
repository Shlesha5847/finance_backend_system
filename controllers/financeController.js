const mongoose = require("mongoose");
const Finance = require("../models/Finance");
const sendResponse = require("../utils/response");
const { validateFinanceInput, VALID_FINANCE_TYPES } = require("../utils/validators");

const parsePagination = (pageRaw, limitRaw) => {
  const page = Number(pageRaw) || 1;
  const limit = Number(limitRaw) || 10;

  return {
    page: page > 0 ? page : 1,
    limit: limit > 0 ? limit : 10
  };
};

const createFinance = async (req, res, next) => {
  try {
    const validationError = validateFinanceInput(req.body);
    if (validationError) {
      return sendResponse(res, 400, false, validationError);
    }

    const finance = await Finance.create({
      ...req.body,
      createdBy: req.user._id
    });

    return sendResponse(res, 201, true, "finance record created", finance);
  } catch (error) {
    next(error);
  }
};

const getFinances = async (req, res, next) => {
  try {
    const { startDate, endDate, category, type, sortBy = "date", order = "desc", page, limit } = req.query;
    const query = {};

    if (startDate || endDate) {
      query.date = {};

      if (startDate) {
        const start = new Date(startDate);
        if (Number.isNaN(start.getTime())) {
          return sendResponse(res, 400, false, "invalid startDate");
        }
        query.date.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        if (Number.isNaN(end.getTime())) {
          return sendResponse(res, 400, false, "invalid endDate");
        }
        query.date.$lte = end;
      }
    }

    if (category) {
      query.category = { $regex: `^${category}$`, $options: "i" };
    }

    if (type) {
      if (!VALID_FINANCE_TYPES.includes(type)) {
        return sendResponse(res, 400, false, "invalid type filter");
      }
      query.type = type;
    }

    const allowedSortFields = ["date", "amount"];
    if (!allowedSortFields.includes(sortBy)) {
      return sendResponse(res, 400, false, "sortBy must be date or amount");
    }

    const normalizedOrder = order === "asc" ? 1 : order === "desc" ? -1 : null;
    if (normalizedOrder === null) {
      return sendResponse(res, 400, false, "order must be asc or desc");
    }

    const { page: parsedPage, limit: parsedLimit } = parsePagination(page, limit);
    const skip = (parsedPage - 1) * parsedLimit;

    const [records, totalRecords] = await Promise.all([
      Finance.find(query)
        .sort({ [sortBy]: normalizedOrder })
        .skip(skip)
        .limit(parsedLimit)
        .populate("createdBy", "name email role"),
      Finance.countDocuments(query)
    ]);

    return sendResponse(res, 200, true, "finance records fetched", {
      records,
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / parsedLimit),
        currentPage: parsedPage,
        limit: parsedLimit
      },
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        category: category || null,
        type: type || null
      },
      sorting: {
        sortBy,
        order
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateFinance = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendResponse(res, 400, false, "invalid finance record id");
    }

    const current = await Finance.findById(id);
    if (!current) {
      return sendResponse(res, 404, false, "finance record not found");
    }

    const mergedBody = {
      title: req.body.title ?? current.title,
      amount: req.body.amount ?? current.amount,
      type: req.body.type ?? current.type,
      category: req.body.category ?? current.category,
      date: req.body.date ?? current.date
    };

    const validationError = validateFinanceInput(mergedBody);
    if (validationError) {
      return sendResponse(res, 400, false, validationError);
    }

    current.title = mergedBody.title;
    current.amount = mergedBody.amount;
    current.type = mergedBody.type;
    current.category = mergedBody.category;
    current.date = mergedBody.date;

    await current.save();

    return sendResponse(res, 200, true, "finance record updated", current);
  } catch (error) {
    next(error);
  }
};

const deleteFinance = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendResponse(res, 400, false, "invalid finance record id");
    }

    const finance = await Finance.findById(id);
    if (!finance) {
      return sendResponse(res, 404, false, "finance record not found");
    }

    await finance.deleteOne();

    return sendResponse(res, 200, true, "finance record deleted");
  } catch (error) {
    next(error);
  }
};

const getSummary = async (_req, res, next) => {
  try {
    const summary = await Finance.aggregate([
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: "$type",
                total: { $sum: "$amount" }
              }
            }
          ],
          categories: [
            {
              $group: {
                _id: "$category",
                total: { $sum: "$amount" }
              }
            },
            {
              $sort: { total: -1 }
            }
          ]
        }
      }
    ]);

    const totals = summary[0]?.totals || [];
    const categories = summary[0]?.categories || [];

    const totalIncome = totals.find((item) => item._id === "income")?.total || 0;
    const totalExpense = totals.find((item) => item._id === "expense")?.total || 0;

    const groupedByCategory = categories.map((item) => ({
      category: item._id,
      total: item.total
    }));

    return sendResponse(res, 200, true, "finance summary fetched", {
      totalIncome,
      totalExpense,
      groupedByCategory
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFinance,
  getFinances,
  updateFinance,
  deleteFinance,
  getSummary
};
