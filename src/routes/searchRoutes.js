const express = require("express");
const router = express.Router();
const searchController = require("../controllers/searchController");

// Global search
router.get("/", searchController.globalSearch);

// Search businesses
router.get("/businesses", searchController.searchBusinesses);

// Search services
router.get("/services", searchController.searchServices);

// Get search suggestions
router.get("/suggestions", searchController.getSuggestions);

// Advanced business filtering
router.get("/filter/businesses", searchController.filterBusinesses);

module.exports = router;
