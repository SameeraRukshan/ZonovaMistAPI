const Tesseract = require('tesseract.js');

/**
 * Get image labels using basic image analysis
 * (Fallback without Google Cloud Vision)
 */
async function getImageLabels(imageUrl) {
  try {
    console.log('🔍 Analyzing image for labels...');
    
    // Perform OCR to detect if it's a document
    const { data: { text, confidence } } = await Tesseract.recognize(
      imageUrl,
      'eng',
      {
        logger: () => {}, // Suppress logs
      }
    );

    const labels = [];

    // Basic heuristics for label detection
    if (text.length > 50) {
      labels.push({ description: 'Text', score: 0.9 });
      labels.push({ description: 'Document', score: 0.85 });
    }

    // Check for NIC-specific keywords
    const nicKeywords = ['national', 'identity', 'card', 'republic', 'sri lanka', 'nic'];
    const lowerText = text.toLowerCase();
    
    const nicMatches = nicKeywords.filter(keyword => lowerText.includes(keyword));
    if (nicMatches.length >= 2) {
      labels.push({ description: 'Identity Card', score: 0.9 });
      labels.push({ description: 'NIC', score: 0.95 });
    }

    // Check if it contains structured data (likely a document)
    const hasDate = /\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(text);
    const hasNumbers = /\d{9,12}/.test(text);
    
    if (hasDate && hasNumbers) {
      labels.push({ description: 'ID Document', score: 0.88 });
    }

    console.log('✅ Detected labels:', labels.map(l => l.description).join(', '));
    
    return labels;
  } catch (error) {
    console.error('❌ Error detecting labels:', error);
    // Return basic label if OCR fails
    return [{ description: 'Image', score: 0.5 }];
  }
}

/**
 * Check if image is a NIC/Document based on labels
 */
function isNICDocument(labels) {
  const nicKeywords = [
    'document', 'nic', 'national identity card', 'identity card',
    'id card', 'national id', 'identity', 'text', 'font',
    'paper', 'identity document', 'card', 'license', 'id document'
  ];

  return labels.some(label => {
    const desc = label.description.toLowerCase();
    return nicKeywords.some(keyword => desc.includes(keyword));
  });
}

/**
 * Perform OCR on image using Tesseract.js
 */
async function performOCR(imageUrl) {
  try {
    console.log('📝 Performing OCR on:', imageUrl);
    
    const { data: { text, confidence } } = await Tesseract.recognize(
      imageUrl,
      'eng',
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      }
    );

    console.log(`✅ OCR completed with ${confidence.toFixed(1)}% confidence`);
    console.log(`📄 Extracted ${text.length} characters`);

    return {
      text: text.trim(),
      confidence: confidence / 100, // Convert to 0-1 range
    };
  } catch (error) {
    console.error('❌ OCR Error:', error);
    throw new Error('OCR processing failed');
  }
}

/**
 * Extract NIC number from text
 */
function extractNICNumber(text) {
  // Remove all whitespace and special chars for easier matching
  const cleanText = text.replace(/\s+/g, '');

  // Old format: 9 digits + V/X (e.g., 123456789V)
  const oldPattern = /\b(\d{9}[VvXx])\b/g;
  const oldMatches = [...cleanText.matchAll(oldPattern)];
  
  if (oldMatches.length > 0) {
    return oldMatches[0][1].toUpperCase();
  }

  // New format: 12 digits (e.g., 199812345678)
  const newPattern = /\b(\d{12})\b/g;
  const newMatches = [...cleanText.matchAll(newPattern)];
  
  if (newMatches.length > 0) {
    // Validate it's a realistic year (between 1900-2010)
    const year = parseInt(newMatches[0][1].substring(0, 4));
    if (year >= 1900 && year <= 2010) {
      return newMatches[0][1];
    }
  }

  return null;
}

/**
 * Extract full name from OCR text
 */
function extractFullName(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // Pattern 1: Look for "Name:" or "Full Name:"
  const namePatterns = [
    /(?:Full\s*)?Name\s*:?\s*([A-Z][A-Za-z\s]{2,50})/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})$/m, // Capitalized multi-word name
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Validate name length and format
      if (name.length >= 3 && name.length <= 60 && /^[A-Za-z\s.]+$/.test(name)) {
        return name;
      }
    }
  }

  // Pattern 2: Look for lines with only uppercase letters (likely name)
  for (const line of lines) {
    if (/^[A-Z\s]{10,50}$/.test(line) && line.split(' ').length >= 2) {
      return line.trim();
    }
  }

  return null;
}

/**
 * Extract date of birth from NIC number
 */
function extractDOBFromNIC(nicNumber) {
  if (!nicNumber) return null;

  try {
    if (nicNumber.length === 10) {
      // Old format: YYDDDXXXXV
      const year = parseInt('19' + nicNumber.substring(0, 2));
      let days = parseInt(nicNumber.substring(2, 5));

      // Subtract 500 for females
      if (days > 500) {
        days -= 500;
      }

      const date = calculateDateFromDays(year, days);
      return date;
    } else if (nicNumber.length === 12) {
      // New format: YYYYDDDXXXXX
      const year = parseInt(nicNumber.substring(0, 4));
      let days = parseInt(nicNumber.substring(4, 7));

      // Subtract 500 for females
      if (days > 500) {
        days -= 500;
      }

      const date = calculateDateFromDays(year, days);
      return date;
    }
  } catch (error) {
    console.error('Error extracting DOB from NIC:', error);
  }

  return null;
}

/**
 * Calculate date from year and day number
 */
function calculateDateFromDays(year, dayOfYear) {
  const date = new Date(year, 0); // January 1st of the year
  date.setDate(dayOfYear);
  return date;
}

/**
 * Extract date of birth from text
 */
function extractDateOfBirth(text, nicNumber) {
  // Method 1: Extract from NIC number
  const dobFromNIC = extractDOBFromNIC(nicNumber);
  if (dobFromNIC) {
    return dobFromNIC;
  }

  // Method 2: Look for date patterns in text
  const datePatterns = [
    /(?:Date\s*of\s*Birth|DOB|Birth\s*Date)\s*:?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i,
    /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b/,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const dateStr = match[1];
      const parsedDate = parseDateString(dateStr);
      if (parsedDate && isValidDOB(parsedDate)) {
        return parsedDate;
      }
    }
  }

  return null;
}

/**
 * Parse date string in various formats
 */
function parseDateString(dateStr) {
  try {
    // Try DD/MM/YYYY or DD-MM-YYYY
    const parts = dateStr.split(/[-/.]/);
    if (parts.length === 3) {
      let [day, month, year] = parts.map(p => parseInt(p));
      
      // Handle 2-digit year
      if (year < 100) {
        year += year > 50 ? 1900 : 2000;
      }

      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  } catch (error) {
    console.error('Error parsing date:', error);
  }
  return null;
}

/**
 * Extract address from OCR text
 */
function extractAddress(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // Look for address keywords
  const addressKeywords = ['Address', 'Residence', 'Postal', 'Street', 'Lane', 'Road'];
  let addressStartIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const keyword of addressKeywords) {
      if (line.toLowerCase().includes(keyword.toLowerCase())) {
        addressStartIndex = i;
        break;
      }
    }
    if (addressStartIndex >= 0) break;
  }

  if (addressStartIndex >= 0) {
    // Take next 2-4 lines as address
    const addressLines = [];
    for (let j = addressStartIndex + 1; j < Math.min(addressStartIndex + 5, lines.length); j++) {
      const cleanLine = lines[j].trim();
      // Stop if we hit another section (like Sex, DOB, etc)
      if (/^(Sex|Date|NIC|Male|Female|Signature):/i.test(cleanLine)) {
        break;
      }
      if (cleanLine.length > 3 && cleanLine.length < 100) {
        addressLines.push(cleanLine);
      }
    }

    if (addressLines.length > 0) {
      return addressLines.join(', ');
    }
  }

  // Fallback: Look for patterns like street addresses
  const addressPattern = /(\d+[A-Za-z]?\s+[A-Za-z\s,]+(?:Street|St|Road|Rd|Lane|Avenue|Ave))/i;
  const match = text.match(addressPattern);
  if (match) {
    return match[1].trim();
  }

  return null;
}

/**
 * Validate NIC number format and checksum
 */
function validateNICNumber(nicNumber) {
  if (!nicNumber) return false;

  // Old format: 9 digits + V/X
  const oldFormatValid = /^\d{9}[VX]$/i.test(nicNumber);

  // New format: 12 digits
  const newFormatValid = /^\d{12}$/.test(nicNumber);

  if (oldFormatValid || newFormatValid) {
    // Verify DOB extraction works (validates the day number is realistic)
    const dob = extractDOBFromNIC(nicNumber);
    return dob !== null && isValidDOB(dob);
  }

  return false;
}

/**
 * Validate date of birth
 */
function isValidDOB(dob) {
  if (!dob || !(dob instanceof Date)) return false;

  const now = new Date();
  const age = (now - dob) / (365.25 * 24 * 60 * 60 * 1000);

  // Age should be between 16 and 120 years
  return age >= 16 && age <= 120;
}

/**
 * Determine NIC format
 */
function getNICFormat(nicNumber) {
  if (!nicNumber) return 'unknown';
  if (/^\d{9}[VX]$/i.test(nicNumber)) return 'old';
  if (/^\d{12}$/.test(nicNumber)) return 'new';
  return 'unknown';
}

/**
 * Main function: Extract all NIC data from image
 */
async function extractNICData(imageUrl) {
  const errors = [];

  try {
    console.log('🔍 Starting NIC data extraction...');
    
    // Step 1: Perform OCR
    const { text: rawText, confidence } = await performOCR(imageUrl);

    if (!rawText || rawText.length < 10) {
      throw new Error('OCR returned insufficient text');
    }

    console.log('📝 Extracted text length:', rawText.length);
    console.log('🎯 OCR confidence:', confidence);

    // Step 2: Extract individual fields
    const nicNumber = extractNICNumber(rawText);
    const fullName = extractFullName(rawText);
    const dateOfBirth = extractDateOfBirth(rawText, nicNumber);
    const address = extractAddress(rawText);

    // Step 3: Validate extracted fields
    const isValidNIC = validateNICNumber(nicNumber);
    const isValidDOB = isValidDOB(dateOfBirth);

    if (!isValidNIC && nicNumber) {
      errors.push({
        field: 'nicNumber',
        message: 'Invalid NIC format detected',
        severity: 'error',
      });
    }

    if (!nicNumber) {
      errors.push({
        field: 'nicNumber',
        message: 'Could not extract NIC number',
        severity: 'error',
      });
    }

    if (!isValidDOB && dateOfBirth) {
      errors.push({
        field: 'dateOfBirth',
        message: 'Invalid date of birth',
        severity: 'warning',
      });
    }

    if (!fullName || fullName.length < 3) {
      errors.push({
        field: 'fullName',
        message: 'Could not extract full name',
        severity: 'warning',
      });
    }

    if (!address || address.length < 5) {
      errors.push({
        field: 'address',
        message: 'Could not extract address',
        severity: 'warning',
      });
    }

    console.log('✅ NIC Extraction Summary:');
    console.log('   - Name:', fullName || 'NOT FOUND');
    console.log('   - NIC:', nicNumber || 'NOT FOUND');
    console.log('   - DOB:', dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : 'NOT FOUND');
    console.log('   - Address:', address ? address.substring(0, 30) + '...' : 'NOT FOUND');

    // Step 4: Return structured data
    return {
      fullName: fullName || null,
      nicNumber: nicNumber || null,
      dateOfBirth: dateOfBirth ? dateOfBirth.toISOString() : null,
      address: address || null,
      extractedText: rawText,
      confidence: Math.round(confidence * 100) / 100,
      nicFormat: getNICFormat(nicNumber),
      isValidNIC,
      isValidDOB,
      fieldsExtracted: {
        name: fullName !== null,
        nic: nicNumber !== null,
        dob: dateOfBirth !== null,
        address: address !== null,
      },
      errors,
    };
  } catch (error) {
    console.error('❌ NIC extraction error:', error);
    return {
      fullName: null,
      nicNumber: null,
      dateOfBirth: null,
      address: null,
      extractedText: '',
      confidence: 0,
      nicFormat: 'unknown',
      isValidNIC: false,
      isValidDOB: false,
      fieldsExtracted: {
        name: false,
        nic: false,
        dob: false,
        address: false,
      },
      errors: [
        {
          field: 'image',
          message: `NIC extraction failed: ${error.message}`,
          severity: 'error',
        },
      ],
    };
  }
}

module.exports = {
  getImageLabels,
  isNICDocument,
  extractNICData,
  validateNICNumber,
  extractDOBFromNIC,
};