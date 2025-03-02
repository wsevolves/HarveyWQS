const express = require("express");
const Category = require("../models/Category");

function categoryRouter(io) {
  const router = express.Router();

  const sendSuccessResponse = (res, msg, data = {}) => {
    res.status(200).json({ status: 1, msg, ...data });
  };

  const sendErrorResponse = (res, statusCode, msg) => {
    res.status(statusCode).json({ status: 2, msg });
  };

  router.get("/get", async (req, res) => {
    try {
      const categories = await Category.find();
      sendSuccessResponse(res, "Categories fetched successfully", { categories });
    } catch (err) {
      console.error("Error fetching categories:", err);
      sendErrorResponse(res, 500, "Server error. Try again later.");
    }
  });


  // Add a new category
  router.post("/add", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return sendErrorResponse(res, 400, "Category name is required");

      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        return sendErrorResponse(res, 400, "Category already exists");
      }

      const newCategory = new Category({ name });
      const savedCategory = await newCategory.save();

      io.emit("categoryAdded", savedCategory);
      sendSuccessResponse(res, "Category added successfully", { category: savedCategory });
    } catch (err) {
      console.error("Error adding category:", err);
      sendErrorResponse(res, 500, "Failed to add category");
    }
  });

  // Update a category
  router.put("/update/:id", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return sendErrorResponse(res, 400, "Category name is required");

      const updatedCategory = await Category.findByIdAndUpdate(req.params.id, { name }, { new: true });
      if (!updatedCategory) return sendErrorResponse(res, 404, "Category not found");

      io.emit("categoryUpdated", updatedCategory);
      sendSuccessResponse(res, "Category updated successfully", { category: updatedCategory });
    } catch (err) {
      console.error("Error updating category:", err);
      sendErrorResponse(res, 500, "Failed to update category");
    }
  });

  
  router.delete("/delete/:id", async (req, res) => {
    try {
      const deletedCategory = await Category.findByIdAndDelete(req.params.id);
      if (!deletedCategory) return sendErrorResponse(res, 404, "Category not found");

      io.emit("categoryDeleted", req.params.id);
      sendSuccessResponse(res, "Category deleted successfully");
    } catch (err) {
      console.error("Error deleting category:", err);
      sendErrorResponse(res, 500, "Failed to delete category");
    }
  });

  return router;
}

module.exports = categoryRouter;