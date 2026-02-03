const vision = require('@google-cloud/vision');

// Initialize Google Vision client with inline credentials support
let visionClient;

try {
  if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    // Use inline credentials from environment variable
    console.log('🔧 Loading Google Vision credentials from GOOGLE_CLOUD_CREDENTIALS...');
    const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
    visionClient = new vision.ImageAnnotatorClient({ 
      credentials: credentials 
    });
    console.log('✅ Google Vision client initialized successfully');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Use credentials file path
    console.log('🔧 Loading Google Vision credentials from file...');
    visionClient = new vision.ImageAnnotatorClient();
    console.log('✅ Google Vision client initialized successfully');
  } else {
    console.warn('⚠️ No Google Cloud credentials found. NIC detection will be disabled.');
    console.warn('Set either GOOGLE_CLOUD_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS');
    visionClient = null;
  }
} catch (error) {
  console.error('❌ Failed to initialize Google Vision client:', error.message);
  console.error('Make sure your GOOGLE_CLOUD_CREDENTIALS is properly formatted JSON');
  visionClient = null;
}

/**
 * Extract labels from image using Google Vision API
 */
async function getImageLabels(imageBuffer) {
  // Check if Vision client is available
  if (!visionClient) {
    console.warn('⚠️ Vision client not initialized. Skipping label detection.');
    return [];
  }
  
  try {
    const [result] = await visionClient.labelDetection({
      image: { content: imageBuffer }
    });
    
    const labels = result.labelAnnotations || [];
    return labels.map(label => ({
      description: label.description,
      score: label.score
    }));
  } catch (error) {
    console.error('Error detecting labels:', error);
    return [];
  }
}

/**
 * Check if image contains NIC-related labels
 */
function isNICDocument(labels) {
  const nicKeywords = [
    'document', 'identity document', 'id card', 
    'identification', 'card', 'text', 'font',
    'license', 'certificate', 'paper'
  ];
  
  const labelDescriptions = labels.map(l => l.description.toLowerCase());
  
  // Check if at least 2 NIC-related keywords are present with good confidence
  const matches = labelDescriptions.filter(desc => 
    nicKeywords.some(keyword => desc.includes(keyword))
  );
  
  return matches.length >= 2;
}

/**
 * Extract text from image using Google Vision OCR
 */
async function extractTextFromImage(imageBuffer) {
  // Check if Vision client is available
  if (!visionClient) {
    console.warn('⚠️ Vision client not initialized. Skipping text extraction.');
    return { text: '', confidence: 0 };
  }
  
  try {
    const [result] = await visionClient.textDetection({
      image: { content: imageBuffer }
    });
    
    const detections = result.textAnnotations;
    if (!detections || detections.length === 0) {
      return { text: '', confidence: 0 };
    }
    
    // First annotation contains full text
    const fullText = detections[0].description || '';
    
    // Calculate average confidence
    const confidence = detections.length > 1 
      ? detections.slice(1).reduce((sum, d) => sum + (d.confidence || 0), 0) / (detections.length - 1)
      : 0;
    
    return {
      text: fullText,
      confidence: confidence
    };
  } catch (error) {
    console.error('Error extracting text:', error);
    return { text: '', confidence: 0 };
  }
}

/**
 * Validate Sri Lankan NIC format
 * Old format: 9 digits + V/X (e.g., 123456789V)
 * New format: 12 digits (e.g., 200012345678)
 */
function validateNICFormat(nic) {
  if (!nic) return { isValid: false, format: 'unknown' };
  
  const cleanNIC = nic.toUpperCase().trim();
  
  // Old format: 9 digits + V/X
  const oldFormatRegex = /^[0-9]{9}[VX]$/;
  if (oldFormatRegex.test(cleanNIC)) {
    return { isValid: true, format: 'old', normalized: cleanNIC };
  }
  
  // New format: 12 digits
  const newFormatRegex = /^[0-9]{12}$/;
  if (newFormatRegex.test(cleanNIC)) {
    return { isValid: true, format: 'new', normalized: cleanNIC };
  }
  
  return { isValid: false, format: 'unknown' };
}

/**
 * Extract date of birth from NIC number
 */
function extractDOBFromNIC(nic, format) {
  if (!nic || format === 'unknown') return null;
  
  try {
    if (format === 'old') {
      // Old format: First 2 digits = year (YY), next 3 = days from Jan 1
      const yearDigits = parseInt(nic.substring(0, 2));
      const year = yearDigits > 50 ? 1900 + yearDigits : 2000 + yearDigits;
      let days = parseInt(nic.substring(2, 5));
      
      // If days > 500, it's a female (subtract 500)
      if (days > 500) {
        days -= 500;
      }
      
      const date = new Date(year, 0, 1);
      date.setDate(date.getDate() + days - 1);
      
      return date;
    } else if (format === 'new') {
      // New format: First 4 digits = year (YYYY), next 3 = days from Jan 1
      const year = parseInt(nic.substring(0, 4));
      let days = parseInt(nic.substring(4, 7));
      
      // If days > 500, it's a female (subtract 500)
      if (days > 500) {
        days -= 500;
      }
      
      const date = new Date(year, 0, 1);
      date.setDate(date.getDate() + days - 1);
      
      return date;
    }
  } catch (error) {
    console.error('Error extracting DOB from NIC:', error);
    return null;
  }
  
  return null;
}

/**
 * Extract NIC number from text
 */
function extractNICNumber(text) {
  if (!text) return null;
  
  const lines = text.split('\n');
  
  // Try to find old format NIC (9 digits + V/X)
  const oldFormatRegex = /\b[0-9]{9}[VX]\b/gi;
  const oldMatches = text.match(oldFormatRegex);
  if (oldMatches && oldMatches.length > 0) {
    return oldMatches[0].toUpperCase();
  }
  
  // Try to find new format NIC (12 digits)
  const newFormatRegex = /\b[0-9]{12}\b/g;
  const newMatches = text.match(newFormatRegex);
  if (newMatches && newMatches.length > 0) {
    return newMatches[0];
  }
  
  return null;
}

/**
 * Extract name from text (usually appears near top)
 */
function extractName(text) {
  if (!text) return null;
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Look for lines that might contain name
  // Names usually appear in first few lines and have 2-4 words with capital letters
  const nameRegex = /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,3}$/;
  
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    
    // Skip lines with numbers or special characters
    if (/[0-9]/.test(line) || line.includes(':')) continue;
    
    // Check if line matches name pattern
    if (nameRegex.test(line) && line.length > 5 && line.length < 50) {
      return line;
    }
  }
  
  // Fallback: look for line with "Name" keyword
  for (const line of lines) {
    if (line.toLowerCase().includes('name')) {
      const parts = line.split(/[:]/);
      if (parts.length > 1) {
        const name = parts[1].trim();
        if (name.length > 3 && name.length < 50) {
          return name;
        }
      }
    }
  }
  
  return null;
}

/**
 * Extract address from text
 */
function extractAddress(text) {
  if (!text) return null;
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Look for lines containing address keywords
  const addressKeywords = ['address', 'residence', 'permanent'];
  let addressStartIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (addressKeywords.some(keyword => line.includes(keyword))) {
      addressStartIndex = i;
      break;
    }
  }
  
  if (addressStartIndex === -1) return null;
  
  // Collect next 2-3 lines as address
  const addressLines = [];
  for (let i = addressStartIndex; i < Math.min(addressStartIndex + 4, lines.length); i++) {
    const line = lines[i];
    
    // Skip the line with "Address:" label itself
    if (addressKeywords.some(keyword => line.toLowerCase().includes(keyword)) && line.includes(':')) {
      const parts = line.split(':');
      if (parts.length > 1 && parts[1].trim().length > 0) {
        addressLines.push(parts[1].trim());
      }
      continue;
    }
    
    // Stop if we hit another section (like DOB, NIC number, etc)
    if (line.toLowerCase().includes('date of birth') || 
        line.toLowerCase().includes('identity') ||
        /[0-9]{9}[VX]|[0-9]{12}/.test(line)) {
      break;
    }
    
    if (line.length > 5 && i > addressStartIndex) {
      addressLines.push(line);
    }
  }
  
  return addressLines.length > 0 ? addressLines.join(', ') : null;
}

/**
 * Main function to extract NIC data
 */
async function extractNICData(imageBuffer) {
  // Check if Vision client is available
  if (!visionClient) {
    console.warn('⚠️ Google Vision not configured. Skipping NIC detection.');
    return {
      isNICDetected: false,
      labels: [],
      nicData: null
    };
  }
  
  try {
    // Step 1: Get image labels
    const labels = await getImageLabels(imageBuffer);
    console.log('📊 Detected labels:', labels.map(l => l.description).join(', '));
    
    // Step 2: Check if it's a NIC document
    const isNIC = isNICDocument(labels);
    
    if (!isNIC) {
      return {
        isNICDetected: false,
        labels: labels.map(l => l.description),
        nicData: null
      };
    }
    
    console.log('🆔 NIC document detected, extracting text...');
    
    // Step 3: Extract text using OCR
    const { text, confidence } = await extractTextFromImage(imageBuffer);
    
    if (!text) {
      return {
        isNICDetected: true,
        labels: labels.map(l => l.description),
        nicData: {
          extractedText: '',
          confidence: 0,
          nicFormat: 'unknown',
          isValidNIC: false,
          isValidDOB: false,
          fieldsExtracted: { name: false, nic: false, dob: false, address: false },
          errors: [{ 
            field: 'general', 
            message: 'Could not extract text from image', 
            severity: 'error' 
          }]
        }
      };
    }
    
    console.log('📝 Extracted text length:', text.length);
    
    // Step 4: Extract NIC number
    const nicNumber = extractNICNumber(text);
    const nicValidation = validateNICFormat(nicNumber);
    
    // Step 5: Extract DOB from NIC
    const dateOfBirth = nicValidation.isValid 
      ? extractDOBFromNIC(nicValidation.normalized, nicValidation.format)
      : null;
    
    // Step 6: Extract name
    const fullName = extractName(text);
    
    // Step 7: Extract address
    const address = extractAddress(text);
    
    // Step 8: Build validation errors
    const errors = [];
    
    if (!nicValidation.isValid && nicNumber) {
      errors.push({
        field: 'nic',
        message: 'NIC number format is invalid',
        severity: 'error'
      });
    }
    
    if (!nicNumber) {
      errors.push({
        field: 'nic',
        message: 'Could not extract NIC number',
        severity: 'error'
      });
    }
    
    if (!fullName) {
      errors.push({
        field: 'name',
        message: 'Could not extract full name',
        severity: 'warning'
      });
    }
    
    if (!address) {
      errors.push({
        field: 'address',
        message: 'Could not extract address',
        severity: 'warning'
      });
    }
    
    if (!dateOfBirth) {
      errors.push({
        field: 'dob',
        message: 'Could not extract date of birth',
        severity: 'warning'
      });
    }
    
    if (confidence < 0.5) {
      errors.push({
        field: 'general',
        message: 'Low text extraction confidence. Please verify all fields.',
        severity: 'warning'
      });
    }
    
    // Validate DOB reasonableness
    let isValidDOB = false;
    if (dateOfBirth) {
      const age = (new Date() - dateOfBirth) / (1000 * 60 * 60 * 24 * 365);
      isValidDOB = age >= 0 && age <= 120;
      
      if (!isValidDOB) {
        errors.push({
          field: 'dob',
          message: 'Extracted date of birth seems unreasonable',
          severity: 'error'
        });
      }
    }
    
    // Step 9: Return structured data
    return {
      isNICDetected: true,
      labels: labels.map(l => l.description),
      nicData: {
        fullName,
        nicNumber: nicValidation.normalized || nicNumber,
        dateOfBirth,
        address,
        extractedText: text,
        confidence,
        nicFormat: nicValidation.format,
        isValidNIC: nicValidation.isValid,
        isValidDOB,
        fieldsExtracted: {
          name: !!fullName,
          nic: !!nicNumber,
          dob: !!dateOfBirth,
          address: !!address
        },
        errors
      }
    };
    
  } catch (error) {
    console.error('❌ Error in extractNICData:', error);
    return {
      isNICDetected: false,
      labels: [],
      nicData: null,
      error: error.message
    };
  }
}

module.exports = {
  extractNICData,
  getImageLabels,
  validateNICFormat,
  extractDOBFromNIC
};