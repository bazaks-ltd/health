# -*- coding: utf-8 -*-
# Copyright (c) 2025, Healthcare and contributors
# For license information, please see license.txt

"""
Patient Duplicate Detection System

This module provides comprehensive duplicate detection for Patient records using:
- Exact matching (mobile, email, uid)
- Soundex algorithm for phonetic name matching
- Fuzzy string matching (Levenshtein distance)
- Combined scoring system for duplicate probability
"""

import frappe
from frappe import _
import re
from datetime import datetime


class DuplicateDetector:
    """
    Comprehensive duplicate detection system for Patient records
    """
    
    # Scoring thresholds
    EXACT_MATCH_SCORE = 100
    HIGH_CONFIDENCE_THRESHOLD = 80
    MEDIUM_CONFIDENCE_THRESHOLD = 60
    LOW_CONFIDENCE_THRESHOLD = 40
    
    def __init__(self, patient_doc):
        self.patient = patient_doc
        self.duplicates = []
        
    def check_duplicates(self):
        """
        Main method to check for duplicates using multiple techniques
        Returns: List of potential duplicates with confidence scores
        """
        potential_duplicates = {}
        
        # 1. Check for exact matches on unique identifiers
        exact_matches = self._check_exact_matches()
        for match in exact_matches:
            key = match.get('name')
            if key not in potential_duplicates:
                potential_duplicates[key] = {
                    'name': key,
                    'patient_name': match.get('patient_name'),
                    'mobile': match.get('mobile'),
                    'email': match.get('email'),
                    'dob': match.get('dob'),
                    'sex': match.get('sex'),
                    'uid': match.get('uid'),
                    'score': 0,
                    'reasons': []
                }
            potential_duplicates[key]['score'] = self.EXACT_MATCH_SCORE
            potential_duplicates[key]['reasons'].append(match.get('reason'))
        
        # 2. Check for phonetic (soundex) name matches
        soundex_matches = self._check_soundex_matches()
        for match in soundex_matches:
            key = match.get('name')
            if key not in potential_duplicates:
                potential_duplicates[key] = {
                    'name': key,
                    'patient_name': match.get('patient_name'),
                    'mobile': match.get('mobile'),
                    'email': match.get('email'),
                    'dob': match.get('dob'),
                    'sex': match.get('sex'),
                    'uid': match.get('uid'),
                    'score': match.get('score', 0),
                    'reasons': [match.get('reason')]
                }
            else:
                potential_duplicates[key]['score'] += match.get('score', 0)
                potential_duplicates[key]['reasons'].append(match.get('reason'))
        
        # 3. Check for fuzzy name matches
        fuzzy_matches = self._check_fuzzy_matches()
        for match in fuzzy_matches:
            key = match.get('name')
            if key not in potential_duplicates:
                potential_duplicates[key] = {
                    'name': key,
                    'patient_name': match.get('patient_name'),
                    'mobile': match.get('mobile'),
                    'email': match.get('email'),
                    'dob': match.get('dob'),
                    'sex': match.get('sex'),
                    'uid': match.get('uid'),
                    'score': match.get('score', 0),
                    'reasons': [match.get('reason')]
                }
            else:
                potential_duplicates[key]['score'] += match.get('score', 0)
                potential_duplicates[key]['reasons'].append(match.get('reason'))
        
        # 4. Check for same name + DOB combinations
        name_dob_matches = self._check_name_dob_matches()
        for match in name_dob_matches:
            key = match.get('name')
            if key not in potential_duplicates:
                potential_duplicates[key] = {
                    'name': key,
                    'patient_name': match.get('patient_name'),
                    'mobile': match.get('mobile'),
                    'email': match.get('email'),
                    'dob': match.get('dob'),
                    'sex': match.get('sex'),
                    'uid': match.get('uid'),
                    'score': match.get('score', 0),
                    'reasons': [match.get('reason')]
                }
            else:
                potential_duplicates[key]['score'] += match.get('score', 0)
                potential_duplicates[key]['reasons'].append(match.get('reason'))
        
        # Sort by score (highest first)
        sorted_duplicates = sorted(
            potential_duplicates.values(),
            key=lambda x: x['score'],
            reverse=True
        )
        
        # Filter by minimum threshold
        return [d for d in sorted_duplicates if d['score'] >= self.LOW_CONFIDENCE_THRESHOLD]
    
    def _check_exact_matches(self):
        """Check for exact matches on mobile, email, or uid"""
        matches = []
        
        # Check mobile (if provided)
        if self.patient.mobile:
            mobile = self._normalize_phone(self.patient.mobile)
            if mobile:
                mobile_display = (self.patient.mobile or '').strip() or mobile
                patients = frappe.db.sql("""
                    SELECT name, patient_name, mobile, email, dob, sex, uid
                    FROM `tabPatient`
                    WHERE name != %s
                    AND IFNULL(status, 'Active') IN ('Active', 'Disabled')
                    AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(mobile, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), '.', ''), '/', '') = %s
                """, (self.patient.name or '', mobile), as_dict=True)
            
                for patient in patients:
                    matches.append({
                        **patient,
                        'reason': _('Exact mobile number match: {0}').format(mobile_display)
                    })
        
        # Check email (if provided)
        if self.patient.email:
            email = self.patient.email.lower().strip()
            patients = frappe.db.sql("""
                SELECT name, patient_name, mobile, email, dob, sex, uid
                FROM `tabPatient`
                WHERE LOWER(email) = %s
                AND name != %s
                AND IFNULL(status, 'Active') IN ('Active', 'Disabled')
            """, (email, self.patient.name or ''), as_dict=True)
            
            for patient in patients:
                matches.append({
                    **patient,
                    'reason': _('Exact email match: {0}').format(email)
                })
        
        # Check uid (if provided)
        if self.patient.uid:
            uid = self.patient.uid.strip()
            patients = frappe.db.sql("""
                SELECT name, patient_name, mobile, email, dob, sex, uid
                FROM `tabPatient`
                WHERE uid = %s
                AND name != %s
                AND IFNULL(status, 'Active') IN ('Active', 'Disabled')
            """, (uid, self.patient.name or ''), as_dict=True)
            
            for patient in patients:
                matches.append({
                    **patient,
                    'reason': _('Exact identification number (UID) match: {0}').format(uid)
                })
        
        # Check phone (if provided)
        if self.patient.phone:
            phone = self._normalize_phone(self.patient.phone)
            if phone:
                phone_display = (self.patient.phone or '').strip() or phone
                patients = frappe.db.sql("""
                    SELECT name, patient_name, mobile, email, dob, sex, uid
                    FROM `tabPatient`
                    WHERE name != %s
                    AND IFNULL(status, 'Active') IN ('Active', 'Disabled')
                    AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(phone, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), '.', ''), '/', '') = %s
                """, (self.patient.name or '', phone), as_dict=True)
                
                for patient in patients:
                    matches.append({
                        **patient,
                        'reason': _('Exact phone number match: {0}').format(phone_display)
                    })
        
        return matches
    
    def _check_soundex_matches(self):
        """Check for phonetic name matches using soundex"""
        matches = []
        
        if not self.patient.first_name:
            return matches
        
        # Get soundex codes for current patient
        first_soundex = self._soundex(self.patient.first_name)
        last_soundex = self._soundex(self.patient.last_name or '')
        
        # Find patients with similar sounding names
        patients = frappe.db.sql("""
            SELECT name, patient_name, first_name, last_name, mobile, email, dob, sex, uid
            FROM `tabPatient`
            WHERE name != %s
            AND IFNULL(status, 'Active') IN ('Active', 'Disabled')
        """, (self.patient.name or '',), as_dict=True)
        
        for patient in patients:
            score = 0
            reason_parts = []
            
            # Compare first name soundex
            if patient.first_name and first_soundex == self._soundex(patient.first_name):
                score += 30
                reason_parts.append(_('similar first name'))
            
            # Compare last name soundex
            if patient.last_name and last_soundex and last_soundex == self._soundex(patient.last_name):
                score += 30
                reason_parts.append(_('similar last name'))
            
            # Additional boost if DOB matches
            if self.patient.dob and patient.dob and str(self.patient.dob) == str(patient.dob):
                score += 30
                reason_parts.append(_('same date of birth'))
            
            # Additional boost if gender matches
            if self.patient.sex and patient.sex and self.patient.sex == patient.sex:
                score += 10
                reason_parts.append(_('same gender'))
            
            if score >= self.LOW_CONFIDENCE_THRESHOLD:
                matches.append({
                    **patient,
                    'score': score,
                    'reason': _('Phonetic match: {0}').format(', '.join(reason_parts))
                })
        
        return matches
    
    def _check_fuzzy_matches(self):
        """Check for fuzzy string matches using Levenshtein distance"""
        matches = []
        
        if not self.patient.first_name:
            return matches
        
        # Get all active patients for fuzzy comparison
        patients = frappe.db.sql("""
            SELECT name, patient_name, first_name, last_name, middle_name, mobile, email, dob, sex, uid
            FROM `tabPatient`
            WHERE name != %s
            AND IFNULL(status, 'Active') IN ('Active', 'Disabled')
            LIMIT 500
        """, (self.patient.name or '',), as_dict=True)
        
        current_full_name = self._normalize_string(
            f"{self.patient.first_name or ''} {self.patient.middle_name or ''} {self.patient.last_name or ''}"
        )
        
        for patient in patients:
            patient_full_name = self._normalize_string(
                f"{patient.first_name or ''} {patient.middle_name or ''} {patient.last_name or ''}"
            )
            
            # Calculate similarity
            similarity = self._calculate_similarity(current_full_name, patient_full_name)
            
            if similarity >= 0.75:  # 75% similarity threshold
                score = int(similarity * 50)  # Max 50 points from fuzzy matching
                
                reason_parts = [_('similar name ({0}% match)').format(int(similarity * 100))]
                
                # Boost score if additional fields match
                if self.patient.dob and patient.dob and str(self.patient.dob) == str(patient.dob):
                    score += 30
                    reason_parts.append(_('same date of birth'))
                
                if self.patient.sex and patient.sex and self.patient.sex == patient.sex:
                    score += 10
                    reason_parts.append(_('same gender'))
                
                matches.append({
                    **patient,
                    'score': score,
                    'reason': _('Fuzzy match: {0}').format(', '.join(reason_parts))
                })
        
        return matches
    
    def _check_name_dob_matches(self):
        """Check for same name and date of birth combinations"""
        matches = []
        
        if not self.patient.first_name or not self.patient.dob:
            return matches
        
        # Normalize names for comparison
        first_name = self._normalize_string(self.patient.first_name)
        last_name = self._normalize_string(self.patient.last_name or '')
        
        patients = frappe.db.sql("""
            SELECT name, patient_name, first_name, last_name, mobile, email, dob, sex, uid
            FROM `tabPatient`
            WHERE dob = %s
            AND name != %s
            AND IFNULL(status, 'Active') IN ('Active', 'Disabled')
        """, (self.patient.dob, self.patient.name or ''), as_dict=True)
        
        for patient in patients:
            patient_first = self._normalize_string(patient.first_name or '')
            patient_last = self._normalize_string(patient.last_name or '')
            
            score = 0
            reason_parts = []
            
            # Check if first names are very similar
            if patient_first and self._calculate_similarity(first_name, patient_first) >= 0.8:
                score += 40
                reason_parts.append(_('similar first name'))
            
            # Check if last names are very similar
            if patient_last and last_name and self._calculate_similarity(last_name, patient_last) >= 0.8:
                score += 40
                reason_parts.append(_('similar last name'))
            
            if score > 0:
                score += 20  # Bonus for matching DOB
                reason_parts.append(_('same date of birth'))
                
                matches.append({
                    **patient,
                    'score': score,
                    'reason': _('Name + DOB match: {0}').format(', '.join(reason_parts))
                })
        
        return matches
    
    @staticmethod
    def _soundex(name):
        """
        Generate soundex code for a name
        Soundex is a phonetic algorithm for indexing names by sound
        """
        if not name:
            return ''
        
        name = name.upper().strip()
        if not name:
            return ''
        
        # Keep first letter
        soundex = name[0]
        
        # Mapping of letters to soundex digits
        mapping = {
            'B': '1', 'F': '1', 'P': '1', 'V': '1',
            'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
            'D': '3', 'T': '3',
            'L': '4',
            'M': '5', 'N': '5',
            'R': '6'
        }
        
        # Convert remaining letters to digits
        prev_code = mapping.get(soundex, '0')
        
        for char in name[1:]:
            code = mapping.get(char, '0')
            
            # Add code if it's different from previous and not 0
            if code != '0' and code != prev_code:
                soundex += code
            
            prev_code = code
            
            # Stop if we have 4 characters
            if len(soundex) == 4:
                break
        
        # Pad with zeros if needed
        soundex = soundex.ljust(4, '0')
        
        return soundex[:4]
    
    @staticmethod
    def _levenshtein_distance(s1, s2):
        """
        Calculate Levenshtein distance between two strings
        (minimum number of single-character edits required to change one word into another)
        """
        if len(s1) < len(s2):
            return DuplicateDetector._levenshtein_distance(s2, s1)
        
        if len(s2) == 0:
            return len(s1)
        
        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                # Cost of insertions, deletions, or substitutions
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]
    
    @staticmethod
    def _calculate_similarity(s1, s2):
        """
        Calculate similarity ratio between two strings (0 to 1)
        1 = identical, 0 = completely different
        """
        if not s1 or not s2:
            return 0.0
        
        distance = DuplicateDetector._levenshtein_distance(s1, s2)
        max_len = max(len(s1), len(s2))
        
        if max_len == 0:
            return 1.0
        
        return 1 - (distance / max_len)
    
    @staticmethod
    def _normalize_string(s):
        """Normalize string for comparison (lowercase, remove extra spaces)"""
        if not s:
            return ''
        return ' '.join(s.lower().strip().split())
    
    @staticmethod
    def _normalize_phone(phone):
        """Normalize phone number (remove spaces, dashes, etc.)"""
        if not phone:
            return ''
        return re.sub(r'\D', '', phone)


@frappe.whitelist()
def check_patient_duplicates(first_name, last_name=None, middle_name=None, mobile=None, email=None, uid=None, dob=None, sex=None, patient_name=None):
    """
    Whitelist method to check for patient duplicates from client side
    Returns list of potential duplicates with confidence scores
    """
    # Create a temporary patient doc for duplicate checking
    temp_patient = frappe._dict({
        'doctype': 'Patient',
        'first_name': first_name,
        'last_name': last_name,
        'middle_name': middle_name,
        'mobile': mobile,
        'email': email,
        'uid': uid,
        'dob': dob,
        'sex': sex,
        'name': patient_name  # For update scenarios
    })
    
    detector = DuplicateDetector(temp_patient)
    duplicates = detector.check_duplicates()
    
    return {
        'has_duplicates': len(duplicates) > 0,
        'duplicates': duplicates,
        'high_confidence_count': len([d for d in duplicates if d['score'] >= detector.HIGH_CONFIDENCE_THRESHOLD]),
        'medium_confidence_count': len([d for d in duplicates if detector.MEDIUM_CONFIDENCE_THRESHOLD <= d['score'] < detector.HIGH_CONFIDENCE_THRESHOLD]),
        'low_confidence_count': len([d for d in duplicates if detector.LOW_CONFIDENCE_THRESHOLD <= d['score'] < detector.MEDIUM_CONFIDENCE_THRESHOLD])
    }
