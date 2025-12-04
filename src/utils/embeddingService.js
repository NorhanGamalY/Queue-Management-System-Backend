const { pipeline } = require('@xenova/transformers');

// Singleton pattern for model loading
let embeddingModel = null;

/**
 * Initialize the embedding model
 * Uses multilingual-e5-small for Arabic and English support
 */
async function initializeModel() {
  if (!embeddingModel) {
    console.log('Loading embedding model...');
    embeddingModel = await pipeline(
      'feature-extraction',
      'Xenova/multilingual-e5-small'
    );
    console.log('Embedding model loaded successfully');
  }
  return embeddingModel;
}

/**
 * Generate embedding for a single text
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<number[]>} - Embedding vector
 */
async function generateEmbedding(text) {
  try {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return null;
    }

    const model = await initializeModel();
    
    // Generate embedding
    const output = await model(text.trim(), {
      pooling: 'mean',
      normalize: true,
    });

    // Convert to array
    const embedding = Array.from(output.data);
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

/**
 * Generate all embeddings for a business
 * @param {Object} business - Business object with name, services, specialization
 * @returns {Promise<Object>} - Object with all embeddings
 */
async function generateBusinessEmbeddings(business) {
  try {
    const embeddings = {};

    // Generate name embedding
    if (business.name) {
      embeddings.nameEmbedding = await generateEmbedding(business.name);
    }

    // Generate specialization embedding
    if (business.specialization) {
      embeddings.specializationEmbedding = await generateEmbedding(
        business.specialization
      );
    }

    // Generate services embedding (combine all service names and descriptions)
    if (business.service && Array.isArray(business.service) && business.service.length > 0) {
      const servicesText = business.service
        .map((s) => `${s.name} ${s.description || ''}`)
        .join(' ');
      embeddings.servicesEmbedding = await generateEmbedding(servicesText);
    }

    // Generate combined embedding (weighted combination)
    // This is useful for faster general search
    if (embeddings.nameEmbedding) {
      const combinedText = [
        business.name,
        business.name, // Weight name more heavily
        business.specialization || '',
        business.service?.map((s) => s.name).join(' ') || '',
      ]
        .filter(Boolean)
        .join(' ');
      
      embeddings.combinedEmbedding = await generateEmbedding(combinedText);
    }

    return embeddings;
  } catch (error) {
    console.error('Error generating business embeddings:', error);
    return {};
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} - Similarity score between -1 and 1
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Find most similar businesses to a query
 * @param {number[]} queryEmbedding - Query embedding vector
 * @param {Array} businesses - Array of business objects with embeddings
 * @param {number} topK - Number of top results to return
 * @returns {Array} - Array of businesses with similarity scores
 */
function findSimilar(queryEmbedding, businesses, topK = 10) {
  if (!queryEmbedding || !businesses || businesses.length === 0) {
    return [];
  }

  // Calculate similarity for each business
  const results = businesses
    .map((business) => {
      let maxSimilarity = 0;

      // Check similarity with combined embedding (fastest)
      if (business.combinedEmbedding) {
        const similarity = cosineSimilarity(
          queryEmbedding,
          business.combinedEmbedding
        );
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      // Also check individual embeddings for better matching
      if (business.nameEmbedding) {
        const similarity = cosineSimilarity(
          queryEmbedding,
          business.nameEmbedding
        );
        maxSimilarity = Math.max(maxSimilarity, similarity * 1.2); // Weight name higher
      }

      if (business.specializationEmbedding) {
        const similarity = cosineSimilarity(
          queryEmbedding,
          business.specializationEmbedding
        );
        maxSimilarity = Math.max(maxSimilarity, similarity * 1.1);
      }

      if (business.servicesEmbedding) {
        const similarity = cosineSimilarity(
          queryEmbedding,
          business.servicesEmbedding
        );
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      return {
        business,
        similarity: maxSimilarity,
      };
    })
    .filter((result) => result.similarity > 0.3) // Filter out very low similarities
    .sort((a, b) => b.similarity - a.similarity) // Sort by similarity descending
    .slice(0, topK); // Take top K results

  return results;
}

module.exports = {
  initializeModel,
  generateEmbedding,
  generateBusinessEmbeddings,
  cosineSimilarity,
  findSimilar,
};
