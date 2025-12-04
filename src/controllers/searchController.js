const Business = require("../models/businessSchema");
const {
  generateEmbedding,
  findSimilar,
} = require("../utils/embeddingService");

// -------------------------
// GET /api/v1/search
// Global search (businesses, services)
// -------------------------
exports.globalSearch = async (req, res) => {
  try {
    const { q, type, location, page = 1, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(q, "i");

    let query = {
      $or: [
        { name: searchRegex },
        { description: searchRegex },
        { "services.name": searchRegex },
        { category: searchRegex },
      ],
    };

    if (type) query.businessType = type;
    if (location) {
      query.$or.push({ "address.city": new RegExp(location, "i") });
      query.$or.push({ "address.state": new RegExp(location, "i") });
    }

    const [businesses, total] = await Promise.all([
      Business.find(query).skip(skip).limit(Number(limit)).select("-__v"),
      Business.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        results: businesses,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Global search error:", error);
    res.status(500).json({
      success: false,
      message: "Error performing search",
    });
  }
};

// -------------------------
// GET /api/v1/search/businesses
// Search businesses
// -------------------------
exports.searchBusinesses = async (req, res) => {
  try {
    const {
      q,
      businessType,
      category,
      location,
      rating,
      priceRange,
      page = 1,
      limit = 10,
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Text search
    if (q) {
      const searchRegex = new RegExp(q, "i");
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
      ];
    }

    // Filters
    if (businessType) query.businessType = businessType;
    if (category) query.category = new RegExp(category, "i");
    if (location) {
      query.$or = query.$or || [];
      query.$or.push(
        { "address.city": new RegExp(location, "i") },
        { "address.state": new RegExp(location, "i") }
      );
    }
    if (rating) query.rating = { $gte: Number(rating) };
    if (priceRange) {
      const [min, max] = priceRange.split("-").map(Number);
      query.priceRange = { $gte: min, $lte: max };
    }

    const [businesses, total] = await Promise.all([
      Business.find(query)
        .skip(skip)
        .limit(Number(limit))
        .sort({ rating: -1, name: 1 })
        .select("-__v"),
      Business.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        businesses,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Search businesses error:", error);
    res.status(500).json({
      success: false,
      message: "Error searching businesses",
    });
  }
};

// -------------------------
// GET /api/v1/search/services
// Search services across businesses
// -------------------------
exports.searchServices = async (req, res) => {
  try {
    const { q, category, priceRange, location, page = 1, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(q, "i");
    const query = {
      "services.name": searchRegex,
    };

    if (category) query["services.category"] = new RegExp(category, "i");
    if (location) {
      query.$or = [
        { "address.city": new RegExp(location, "i") },
        { "address.state": new RegExp(location, "i") },
      ];
    }
    if (priceRange) {
      const [min, max] = priceRange.split("-").map(Number);
      query["services.price"] = { $gte: min, $lte: max };
    }

    const businesses = await Business.find(query)
      .skip(skip)
      .limit(Number(limit))
      .select("name address services rating")
      .lean();

    // Filter services that match the search
    const results = businesses.flatMap((business) =>
      business.services
        .filter((service) => searchRegex.test(service.name))
        .map((service) => ({
          service,
          business: {
            id: business._id,
            name: business.name,
            address: business.address,
            rating: business.rating,
          },
        }))
    );

    const total = results.length;

    res.status(200).json({
      success: true,
      data: {
        services: results.slice(0, limit),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Search services error:", error);
    res.status(500).json({
      success: false,
      message: "Error searching services",
    });
  }
};

// -------------------------
// GET /api/v1/search/suggestions
// Get search suggestions (autocomplete)
// -------------------------
exports.getSuggestions = async (req, res) => {
  try {
    const { q, type = "business" } = req.query;

    if (!q || q.length < 2) {
      return res.status(200).json({
        success: true,
        data: { suggestions: [] },
      });
    }

    const searchRegex = new RegExp(`^${q}`, "i");
    let suggestions = [];

    if (type === "business" || type === "all") {
      const businesses = await Business.find({ name: searchRegex })
        .limit(5)
        .select("name businessType");

      suggestions = suggestions.concat(
        businesses.map((b) => ({
          text: b.name,
          type: "business",
          id: b._id,
        }))
      );
    }

    if (type === "service" || type === "all") {
      const businesses = await Business.find({
        "services.name": searchRegex,
      })
        .limit(5)
        .select("services.name");

      const serviceNames = new Set();
      businesses.forEach((b) => {
        b.services.forEach((s) => {
          if (searchRegex.test(s.name)) {
            serviceNames.add(s.name);
          }
        });
      });

      suggestions = suggestions.concat(
        Array.from(serviceNames).map((name) => ({
          text: name,
          type: "service",
        }))
      );
    }

    res.status(200).json({
      success: true,
      data: { suggestions: suggestions.slice(0, 10) },
    });
  } catch (error) {
    console.error("Get suggestions error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching suggestions",
    });
  }
};

// -------------------------
// GET /api/v1/filter/businesses
// Advanced business filtering
// -------------------------
exports.filterBusinesses = async (req, res) => {
  try {
    const {
      location,
      rating,
      priceRange,
      features,
      openNow,
      businessType,
      category,
      page = 1,
      limit = 10,
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Location filter
    if (location) {
      query.$or = [
        { "address.city": new RegExp(location, "i") },
        { "address.state": new RegExp(location, "i") },
        { "address.country": new RegExp(location, "i") },
      ];
    }

    // Rating filter
    if (rating) query.rating = { $gte: Number(rating) };

    // Price range filter
    if (priceRange) {
      const [min, max] = priceRange.split("-").map(Number);
      query.priceRange = { $gte: min, $lte: max };
    }

    // Features filter
    if (features) {
      const featureArray = features.split(",");
      query.features = { $all: featureArray };
    }

    // Business type filter
    if (businessType) query.businessType = businessType;

    // Category filter
    if (category) query.category = new RegExp(category, "i");

    // Open now filter
    if (openNow === "true") {
      const now = new Date();
      const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "lowercase" });
      const currentTime = now.toTimeString().slice(0, 5);

      query[`workingHours.${dayOfWeek}.isOpen`] = true;
      query[`workingHours.${dayOfWeek}.from`] = { $lte: currentTime };
      query[`workingHours.${dayOfWeek}.to`] = { $gte: currentTime };
    }

    const [businesses, total] = await Promise.all([
      Business.find(query)
        .skip(skip)
        .limit(Number(limit))
        .sort({ rating: -1, name: 1 })
        .select("-__v"),
      Business.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        businesses,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
        filters: {
          location,
          rating,
          priceRange,
          features,
          openNow,
          businessType,
          category,
        },
      },
    });
  } catch (error) {
    console.error("Filter businesses error:", error);
    res.status(500).json({
      success: false,
      message: "Error filtering businesses",
    });
  }
};

// -------------------------
// GET /api/v1/search/semantic
// Semantic search using AI embeddings
// -------------------------
exports.semanticSearchBusinesses = async (req, res) => {
  try {
    const {
      q,
      location,
      rating,
      priceRange,
      businessType,
      category,
      page = 1,
      limit = 10,
    } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    // Generate embedding for search query
    const queryEmbedding = await generateEmbedding(q.trim());

    if (!queryEmbedding) {
      // Fallback to keyword search if embedding fails
      console.warn("Embedding generation failed, falling back to keyword search");
      return exports.searchBusinesses(req, res);
    }

    // Fetch all businesses (with filters if provided)
    const query = {};
    
    if (businessType) query.businessType = businessType;
    if (category) query.category = new RegExp(category, "i");
    if (location) {
      query.$or = [
        { "address": new RegExp(location, "i") },
      ];
    }
    if (rating) query.rating = { $gte: Number(rating) };

    const allBusinesses = await Business.find(query).select("-password -__v");

    // Find similar businesses using embeddings
    const similarBusinesses = findSimilar(
      queryEmbedding,
      allBusinesses,
      Number(limit) * 3 // Get more results for pagination
    );

    // Pagination
    const skip = (page - 1) * limit;
    const paginatedResults = similarBusinesses.slice(skip, skip + Number(limit));

    // Format results
    const results = paginatedResults.map((result) => ({
      ...result.business.toObject(),
      relevanceScore: result.similarity,
    }));

    res.status(200).json({
      success: true,
      data: {
        businesses: results,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: similarBusinesses.length,
          pages: Math.ceil(similarBusinesses.length / limit),
        },
        searchType: "semantic",
      },
    });
  } catch (error) {
    console.error("Semantic search error:", error);
    res.status(500).json({
      success: false,
      message: "Error performing semantic search",
    });
  }
};
