/**
 * Similarity Utility
 * Provides various similarity calculation methods for vector operations
 */

class Similarity {
  /**
   * Calculate cosine similarity between two vectors
   * @param {Array} vectorA - First vector
   * @param {Array} vectorB - Second vector
   * @returns {number} Cosine similarity score (0-1)
   */
  static cosineSimilarity(vectorA, vectorB) {
    if (!vectorA || !vectorB || vectorA.length !== vectorB.length) {
      throw new Error("Vectors must be non-null and of equal length");
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      const a = vectorA[i];
      const b = vectorB[i];

      dotProduct += a * b;
      magnitudeA += a * a;
      magnitudeB += b * b;
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Calculate Euclidean distance between two vectors
   * @param {Array} vectorA - First vector
   * @param {Array} vectorB - Second vector
   * @returns {number} Euclidean distance
   */
  static euclideanDistance(vectorA, vectorB) {
    if (!vectorA || !vectorB || vectorA.length !== vectorB.length) {
      throw new Error("Vectors must be non-null and of equal length");
    }

    let sum = 0;
    for (let i = 0; i < vectorA.length; i++) {
      const diff = vectorA[i] - vectorB[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * Calculate Manhattan distance between two vectors
   * @param {Array} vectorA - First vector
   * @param {Array} vectorB - Second vector
   * @returns {number} Manhattan distance
   */
  static manhattanDistance(vectorA, vectorB) {
    if (!vectorA || !vectorB || vectorA.length !== vectorB.length) {
      throw new Error("Vectors must be non-null and of equal length");
    }

    let sum = 0;
    for (let i = 0; i < vectorA.length; i++) {
      sum += Math.abs(vectorA[i] - vectorB[i]);
    }

    return sum;
  }

  /**
   * Calculate dot product between two vectors
   * @param {Array} vectorA - First vector
   * @param {Array} vectorB - Second vector
   * @returns {number} Dot product
   */
  static dotProduct(vectorA, vectorB) {
    if (!vectorA || !vectorB || vectorA.length !== vectorB.length) {
      throw new Error("Vectors must be non-null and of equal length");
    }

    let product = 0;
    for (let i = 0; i < vectorA.length; i++) {
      product += vectorA[i] * vectorB[i];
    }

    return product;
  }

  /**
   * Calculate vector magnitude (L2 norm)
   * @param {Array} vector - Input vector
   * @returns {number} Vector magnitude
   */
  static magnitude(vector) {
    if (!vector || vector.length === 0) {
      throw new Error("Vector must be non-null and non-empty");
    }

    let sum = 0;
    for (let i = 0; i < vector.length; i++) {
      sum += vector[i] * vector[i];
    }

    return Math.sqrt(sum);
  }

  /**
   * Normalize vector to unit length
   * @param {Array} vector - Input vector
   * @returns {Array} Normalized vector
   */
  static normalize(vector) {
    if (!vector || vector.length === 0) {
      throw new Error("Vector must be non-null and non-empty");
    }

    const mag = this.magnitude(vector);
    if (mag === 0) {
      return new Array(vector.length).fill(0);
    }

    return vector.map((component) => component / mag);
  }

  /**
   * Calculate Jaccard similarity between two sets
   * @param {Set|Array} setA - First set
   * @param {Set|Array} setB - Second set
   * @returns {number} Jaccard similarity (0-1)
   */
  static jaccardSimilarity(setA, setB) {
    const a = new Set(setA);
    const b = new Set(setB);

    const intersection = new Set([...a].filter((x) => b.has(x)));
    const union = new Set([...a, ...b]);

    if (union.size === 0) {
      return 0;
    }

    return intersection.size / union.size;
  }

  /**
   * Calculate text similarity using n-grams
   * @param {string} textA - First text
   * @param {string} textB - Second text
   * @param {number} n - N-gram size (default: 2)
   * @returns {number} Text similarity (0-1)
   */
  static textSimilarity(textA, textB, n = 2) {
    if (!textA || !textB) {
      return 0;
    }

    const ngramsA = this.generateNGrams(textA.toLowerCase(), n);
    const ngramsB = this.generateNGrams(textB.toLowerCase(), n);

    return this.jaccardSimilarity(ngramsA, ngramsB);
  }

  /**
   * Generate n-grams from text
   * @param {string} text - Input text
   * @param {number} n - N-gram size
   * @returns {Array} Array of n-grams
   */
  static generateNGrams(text, n) {
    const ngrams = [];
    const cleaned = text
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    for (let i = 0; i <= cleaned.length - n; i++) {
      ngrams.push(cleaned.substring(i, i + n));
    }

    return ngrams;
  }

  /**
   * Calculate semantic similarity using multiple methods
   * @param {Array} vectorA - First vector
   * @param {Array} vectorB - Second vector
   * @param {Object} options - Calculation options
   * @returns {Object} Multiple similarity scores
   */
  static semanticSimilarity(vectorA, vectorB, options = {}) {
    const {
      includeCosine = true,
      includeEuclidean = false,
      includeManhattan = false,
      includeDotProduct = false,
      normalizeVectors = false,
    } = options;

    let a = vectorA;
    let b = vectorB;

    if (normalizeVectors) {
      a = this.normalize(vectorA);
      b = this.normalize(vectorB);
    }

    const results = {};

    if (includeCosine) {
      results.cosine = this.cosineSimilarity(a, b);
    }

    if (includeEuclidean) {
      const distance = this.euclideanDistance(a, b);
      // Convert distance to similarity (0-1 scale)
      results.euclidean = 1 / (1 + distance);
    }

    if (includeManhattan) {
      const distance = this.manhattanDistance(a, b);
      // Convert distance to similarity (0-1 scale)
      results.manhattan = 1 / (1 + distance);
    }

    if (includeDotProduct) {
      results.dotProduct = this.dotProduct(a, b);
    }

    return results;
  }

  /**
   * Find top K most similar vectors
   * @param {Array} queryVector - Query vector
   * @param {Array} vectorDatabase - Array of vectors with metadata
   * @param {number} k - Number of top results to return
   * @param {string} method - Similarity method ('cosine', 'euclidean', 'manhattan')
   * @returns {Array} Top K similar vectors with scores
   */
  static findTopKSimilar(
    queryVector,
    vectorDatabase,
    k = 10,
    method = "cosine"
  ) {
    if (!queryVector || !vectorDatabase || vectorDatabase.length === 0) {
      return [];
    }

    const similarities = vectorDatabase.map((item, index) => {
      let score;

      switch (method) {
        case "cosine":
          score = this.cosineSimilarity(queryVector, item.vector || item);
          break;
        case "euclidean":
          const euclideanDist = this.euclideanDistance(
            queryVector,
            item.vector || item
          );
          score = 1 / (1 + euclideanDist); // Convert to similarity
          break;
        case "manhattan":
          const manhattanDist = this.manhattanDistance(
            queryVector,
            item.vector || item
          );
          score = 1 / (1 + manhattanDist); // Convert to similarity
          break;
        default:
          throw new Error(`Unsupported similarity method: ${method}`);
      }

      return {
        index,
        score,
        item: item.metadata ? item : { vector: item, metadata: {} },
      };
    });

    // Sort by score (descending) and return top K
    return similarities.sort((a, b) => b.score - a.score).slice(0, k);
  }

  /**
   * Calculate similarity matrix for a set of vectors
   * @param {Array} vectors - Array of vectors
   * @param {string} method - Similarity method
   * @returns {Array} 2D similarity matrix
   */
  static calculateSimilarityMatrix(vectors, method = "cosine") {
    const matrix = [];

    for (let i = 0; i < vectors.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < vectors.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0; // Self-similarity is always 1
        } else {
          switch (method) {
            case "cosine":
              matrix[i][j] = this.cosineSimilarity(vectors[i], vectors[j]);
              break;
            case "euclidean":
              const euclideanDist = this.euclideanDistance(
                vectors[i],
                vectors[j]
              );
              matrix[i][j] = 1 / (1 + euclideanDist);
              break;
            case "manhattan":
              const manhattanDist = this.manhattanDistance(
                vectors[i],
                vectors[j]
              );
              matrix[i][j] = 1 / (1 + manhattanDist);
              break;
            default:
              throw new Error(`Unsupported similarity method: ${method}`);
          }
        }
      }
    }

    return matrix;
  }

  /**
   * Cluster vectors using similarity threshold
   * @param {Array} vectors - Array of vectors with metadata
   * @param {number} threshold - Similarity threshold (0-1)
   * @param {string} method - Similarity method
   * @returns {Array} Array of clusters
   */
  static clusterBySimilarity(vectors, threshold = 0.8, method = "cosine") {
    const clusters = [];
    const assigned = new Set();

    for (let i = 0; i < vectors.length; i++) {
      if (assigned.has(i)) continue;

      const cluster = [i];
      assigned.add(i);

      for (let j = i + 1; j < vectors.length; j++) {
        if (assigned.has(j)) continue;

        let similarity;
        switch (method) {
          case "cosine":
            similarity = this.cosineSimilarity(
              vectors[i].vector || vectors[i],
              vectors[j].vector || vectors[j]
            );
            break;
          case "euclidean":
            const euclideanDist = this.euclideanDistance(
              vectors[i].vector || vectors[i],
              vectors[j].vector || vectors[j]
            );
            similarity = 1 / (1 + euclideanDist);
            break;
          case "manhattan":
            const manhattanDist = this.manhattanDistance(
              vectors[i].vector || vectors[i],
              vectors[j].vector || vectors[j]
            );
            similarity = 1 / (1 + manhattanDist);
            break;
          default:
            throw new Error(`Unsupported similarity method: ${method}`);
        }

        if (similarity >= threshold) {
          cluster.push(j);
          assigned.add(j);
        }
      }

      clusters.push({
        indices: cluster,
        vectors: cluster.map((idx) => vectors[idx]),
        size: cluster.length,
        centroid: this.calculateCentroid(
          cluster.map((idx) => vectors[idx].vector || vectors[idx])
        ),
      });
    }

    return clusters;
  }

  /**
   * Calculate centroid of a set of vectors
   * @param {Array} vectors - Array of vectors
   * @returns {Array} Centroid vector
   */
  static calculateCentroid(vectors) {
    if (!vectors || vectors.length === 0) {
      return [];
    }

    const dimensions = vectors[0].length;
    const centroid = new Array(dimensions).fill(0);

    for (const vector of vectors) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += vector[i];
      }
    }

    return centroid.map((component) => component / vectors.length);
  }

  /**
   * Validate vector format and dimensions
   * @param {Array} vector - Vector to validate
   * @param {number} expectedDimensions - Expected number of dimensions
   * @returns {boolean} Whether vector is valid
   */
  static isValidVector(vector, expectedDimensions = null) {
    if (!Array.isArray(vector)) {
      return false;
    }

    if (vector.length === 0) {
      return false;
    }

    if (expectedDimensions && vector.length !== expectedDimensions) {
      return false;
    }

    return vector.every(
      (component) => typeof component === "number" && !isNaN(component)
    );
  }
}

module.exports = Similarity;
