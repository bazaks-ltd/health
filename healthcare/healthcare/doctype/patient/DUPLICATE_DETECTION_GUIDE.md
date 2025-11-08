# Patient Duplicate Detection System

## Overview

This comprehensive duplicate detection system prevents the creation of duplicate patient records using multiple advanced techniques including:

- **Exact Matching**: Mobile, email, phone, and UID (identification number)
- **Soundex Algorithm**: Phonetic name matching to catch similar-sounding names
- **Fuzzy Matching**: Levenshtein distance for catching typos and variations
- **Multi-field Matching**: Combines name, date of birth, and gender for high-confidence detection

## Features

### 1. Real-Time Client-Side Detection

As users enter patient information, the system automatically checks for duplicates in the background:

- **Debounced Checking**: Waits for user to stop typing before checking (1.5 seconds for names, 0.5 seconds for unique identifiers)
- **Visual Indicators**: Shows alerts and dashboard indicators when duplicates are found
- **Interactive Review**: Allows users to review potential duplicates before proceeding

### 2. Server-Side Validation

When attempting to save a new patient, the system performs a comprehensive check:

- **High Confidence Matches (Score ≥ 80)**: **BLOCKS** creation and shows detailed error message
- **Medium Confidence Matches (Score 60-79)**: Shows **WARNING** but allows creation
- **Low Confidence Matches (Score 40-59)**: Logged but doesn't alert user

### 3. Scoring System

Each potential duplicate gets a confidence score based on:

| Match Type | Score | Description |
|------------|-------|-------------|
| Exact mobile/email/UID | 100 | Identical unique identifier |
| Phonetic first name match | +30 | Names sound the same (soundex) |
| Phonetic last name match | +30 | Last names sound the same |
| Same date of birth | +30 | Identical DOB |
| Same gender | +10 | Gender matches |
| Fuzzy name match (75%+) | up to +50 | Similar name strings |
| Name + DOB combination | +80-100 | Very high confidence |

## How It Works

### Detection Techniques

#### 1. Soundex Algorithm

Converts names to phonetic codes to catch similar-sounding names:

```python
Examples:
- "John" → J500
- "Jon" → J500
- "Muhammad" → M530
- "Mohamed" → M530
- "Smith" → S530
- "Smyth" → S530
```

This catches common variations in spelling and pronunciation.

#### 2. Levenshtein Distance (Fuzzy Matching)

Calculates the minimum number of edits needed to transform one string into another:

```python
Examples:
- "Mohammed" vs "Muhammad" → 75% similar
- "Smith" vs "Smyth" → 83% similar
- "John Doe" vs "Jon Do" → 78% similar
```

#### 3. Exact Matching

Direct comparison of:
- Mobile numbers (normalized, no spaces/dashes)
- Email addresses (case-insensitive)
- UID/identification numbers
- Phone numbers

#### 4. Combined Matching

Checks combinations like:
- Same name + same DOB = Very high confidence
- Similar name + same DOB + same gender = High confidence
- Soundex match + same DOB = Medium-high confidence

## User Experience

### For End Users (Nurses, Receptionists)

#### Creating a New Patient

1. **Start entering patient information** (first name, last name, mobile, etc.)

2. **Automatic checking occurs** as you type:
   - Progress indicator shows "Checking for duplicates..."
   - Check happens 1.5 seconds after you stop typing

3. **If duplicates are found:**
   
   **High Confidence Duplicates:**
   - Red alert appears: "Warning: X potential duplicate(s) found!"
   - Red indicator on form dashboard
   - Alert banner with "Review Duplicates" button
   - **Attempting to save will be BLOCKED** with error message

   **Medium Confidence Duplicates:**
   - Orange alert appears: "Note: X possible duplicate(s) found"
   - Orange indicator on form dashboard
   - Warning message but **can still save**

4. **Review Duplicates:**
   - Click "Review Duplicates" button or "Check for Duplicates" in Tools menu
   - Dialog opens showing all potential duplicates with:
     - Confidence level (High/Medium/Low)
     - Patient name and ID
     - Contact information
     - Date of birth
     - Reasons for match
     - "Open" button to view existing record

5. **Options:**
   - **Cancel**: Close the form and use existing patient
   - **Open Existing**: Click "Open" button to view the existing patient
   - **Continue Anyway**: Override the duplicate check (for high-confidence matches, contact admin)

### Manual Duplicate Check

At any time, you can manually check for duplicates:
1. Click **Tools** → **Check for Duplicates**
2. Review the results
3. Decide whether to proceed or use existing patient

## For Administrators

### Configuration

The duplicate detection system works out of the box with no configuration needed. However, you can adjust thresholds in the code:

```python
# In patient_duplicate_checker.py

class DuplicateDetector:
    # Adjust these thresholds as needed
    EXACT_MATCH_SCORE = 100
    HIGH_CONFIDENCE_THRESHOLD = 80  # Blocks creation
    MEDIUM_CONFIDENCE_THRESHOLD = 60  # Shows warning
    LOW_CONFIDENCE_THRESHOLD = 40  # Minimum to report
```

### Bypassing Duplicate Check

In rare cases where you need to create a patient despite duplicates:

**Option 1: Using System Manager Role**
```python
# In Python console or custom script
patient = frappe.get_doc({
    'doctype': 'Patient',
    'first_name': 'John',
    'last_name': 'Doe',
    # ... other fields ...
})
patient.flags.ignore_duplicate_check = True
patient.insert()
```

**Option 2: Temporarily disable validation**
- Ask a System Manager to disable the check
- Create the patient
- Re-enable the check

### Performance Considerations

The duplicate checker is optimized for performance:

1. **Debounced client-side checks**: Reduces server load
2. **Limited SQL queries**: Maximum 500 patients checked for fuzzy matching
3. **Indexed fields**: Uses indexed fields (mobile, email, uid) for exact matching
4. **Early termination**: Stops checking once high-confidence match is found

For very large databases (>100,000 patients):
- Consider increasing debounce delay
- Adjust fuzzy matching limit
- Add additional database indexes

## API Reference

### Python API

```python
from healthcare.healthcare.doctype.patient.patient_duplicate_checker import DuplicateDetector

# Create detector instance
detector = DuplicateDetector(patient_doc)

# Check for duplicates
duplicates = detector.check_duplicates()

# Returns list of dicts with:
# - name: Patient ID
# - patient_name: Full name
# - score: Confidence score (0-100)
# - reasons: List of match reasons
# - mobile, email, dob, sex, uid: Patient fields
```

### JavaScript API

```javascript
// Check for duplicates from client-side
frappe.call({
    method: 'healthcare.healthcare.doctype.patient.patient_duplicate_checker.check_patient_duplicates',
    args: {
        first_name: 'John',
        last_name: 'Doe',
        mobile: '1234567890',
        // ... other fields
    },
    callback: function(r) {
        if (r.message.has_duplicates) {
            // Handle duplicates
            console.log(r.message.duplicates);
        }
    }
});
```

## Examples

### Example 1: Exact Mobile Match

**Input:**
- Name: Jane Smith
- Mobile: 555-1234

**Existing Patient:**
- Name: Jane S.
- Mobile: 555-1234

**Result:** BLOCKED (Score: 100) - Exact mobile match

### Example 2: Soundex Name Match

**Input:**
- Name: Muhammad Ali
- DOB: 1990-01-15

**Existing Patient:**
- Name: Mohamed Ali
- DOB: 1990-01-15

**Result:** BLOCKED (Score: 90) - Phonetic name match + same DOB

### Example 3: Fuzzy Match

**Input:**
- Name: Katherine Johnson
- DOB: 1985-06-20

**Existing Patient:**
- Name: Kathrin Jonson
- DOB: 1985-06-20

**Result:** BLOCKED (Score: 85) - High similarity + same DOB

### Example 4: Low Confidence

**Input:**
- Name: John Smith
- DOB: 1980-03-10

**Existing Patient:**
- Name: John Smyth
- DOB: 1985-07-22

**Result:** WARNING (Score: 65) - Similar names but different DOB

## Troubleshooting

### Issue: Too many false positives

**Solution:** Increase thresholds
```python
HIGH_CONFIDENCE_THRESHOLD = 85  # Was 80
MEDIUM_CONFIDENCE_THRESHOLD = 70  # Was 60
```

### Issue: Missing duplicates

**Solution:** Decrease thresholds or adjust similarity calculation
```python
# In _check_fuzzy_matches, reduce similarity threshold
if similarity >= 0.70:  # Was 0.75
    # Consider it a match
```

### Issue: Slow performance

**Solution:** Reduce fuzzy match limit
```python
# In _check_fuzzy_matches
LIMIT 200  # Was 500
```

### Issue: Need to bypass for specific case

**Solution:** Use System Manager override or contact admin

## Best Practices

1. **Train staff** on duplicate detection workflow
2. **Review alerts seriously** - they prevent data quality issues
3. **Use UID field** when available for strongest duplicate prevention
4. **Keep mobile/email updated** in existing records
5. **Standardize name entry** (e.g., always "First Middle Last" format)
6. **Regular audits** - periodically search for duplicates that slipped through

## Technical Details

### Files Modified/Created

- `patient_duplicate_checker.py` - Core duplicate detection logic
- `patient.py` - Integration with Patient doctype validation
- `patient.js` - Client-side duplicate checking and UI
- `DUPLICATE_DETECTION_GUIDE.md` - This documentation

### Database Queries

The system uses optimized SQL queries:
1. Direct indexed lookups for exact matches
2. Limited result sets for fuzzy matching
3. Only queries active patients

### Security

- All checks respect user permissions
- Only returns patients user has access to
- Prevents SQL injection through parameterized queries

## Future Enhancements

Potential improvements:
- Machine learning-based duplicate detection
- Address-based matching
- Biometric matching integration
- Batch duplicate detection for existing records
- Duplicate merging tool

## Support

For issues or questions:
1. Check error logs in Frappe
2. Review this documentation
3. Contact system administrator
4. Report bugs in issue tracker

---

**Version:** 1.0  
**Last Updated:** October 2025  
**Author:** Healthcare Team





