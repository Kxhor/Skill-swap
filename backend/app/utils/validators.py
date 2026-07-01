import re


def validate_email(email):
    if not email:
        return False, "Email is required"
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        return False, "Please enter a valid email address"
    return True, ""


def validate_password(password):
    if not password:
        return False, "Password is required"
    if len(password) < 6:
        return False, "Password must be at least 6 characters long"
    if len(password) > 128:
        return False, "Password must be less than 128 characters"
    return True, ""


def validate_name(name):
    if not name:
        return False, "Name is required"
    if len(name) < 2:
        return False, "Name must be at least 2 characters long"
    if len(name) > 100:
        return False, "Name must be less than 100 characters"
    if not re.match(r'^[a-zA-Z\s\'-]+$', name):
        return False, "Name can only contain letters, spaces, hyphens, and apostrophes"
    return True, ""


def validate_skill_name(skill_name):
    if not skill_name:
        return False, "Skill name is required"
    if len(skill_name) < 2:
        return False, "Skill name must be at least 2 characters long"
    if len(skill_name) > 100:
        return False, "Skill name must be less than 100 characters"
    if not re.match(r'^[a-zA-Z0-9\s\-]+$', skill_name):
        return False, "Skill name can only contain letters, numbers, spaces, and hyphens"
    return True, ""


def validate_rating(rating):
    try:
        val = int(rating)
        if val < 1 or val > 5:
            return False, "Rating must be between 1 and 5"
        return True, ""
    except (ValueError, TypeError):
        return False, "Rating must be a number between 1 and 5"


def validate_location(location):
    if not location:
        return True, ""
    if len(location) > 100:
        return False, "Location must be less than 100 characters"
    return True, ""


import bleach

def sanitize_text(text, max_length=1000):
    if not text:
        return ""
    text = bleach.clean(text, strip=True)
    if len(text) > max_length:
        text = text[:max_length]
    return text.strip()


def validate_availability_slot(day_of_week, start_time, end_time):
    valid_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    if day_of_week.lower() not in valid_days:
        return False, "Invalid day of week"
    if not start_time or not end_time:
        return False, "Start time and end time are required"
    return True, ""


def validate_proficiency_level(level):
    valid_levels = ["beginner", "intermediate", "expert"]
    if level not in valid_levels:
        return False, "Invalid proficiency level"
    return True, ""


def validate_skill_type(skill_type):
    if skill_type not in ["offered", "wanted"]:
        return False, "Skill type must be 'offered' or 'wanted'"
    return True, ""
