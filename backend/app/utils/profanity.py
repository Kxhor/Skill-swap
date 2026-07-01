import re

# A basic blacklist of severe profanity in English, Tamil, Hindi, Telugu, Malayalam.
# Note: In a real production system, this would be backed by a sophisticated NLP model or a comprehensive dictionary.
PROFANITY_LIST = [
    # English
    r'\bfuck\b', r'\bshit\b', r'\bbitch\b', r'\basshole\b', r'\bcunt\b', r'\bdick\b', r'\bpussy\b', r'\bslut\b', r'\bwhore\b', r'\bbastard\b', r'\bmotherfucker\b',
    # Hindi (Transliterated)
    r'\bmadarchod\b', r'\bbhenchod\b', r'\bchutiya\b', r'\bgaandu\b', r'\bharami\b', r'\bkamina\b', r'\bteri maa ki\b', r'\bteri ma ki\b', r'\bchodu\b', r'\bgaand\b', r'\blund\b',
    # Tamil (Transliterated)
    r'\bthevidiya\b', r'\boomba\b', r'\bommale\b', r'\bbaadu\b', r'\bkoothi\b', r'\bpoolu\b', r'\bmayiru\b', r'\bpunnakku\b',
    # Telugu (Transliterated)
    r'\blanjakodaka\b', r'\bnee yamma\b', r'\bnee abba\b', r'\bdengey\b', r'\bpuuku\b', r'\bmodda\b', r'\berripuuku\b',
    # Malayalam (Transliterated)
    r'\bthendi\b', r'\bthayoli\b', r'\bkazhuveri\b', r'\bpooru\b', r'\bkundan\b', r'\bmyre\b', r'\bmyran\b'
]

# Compile patterns for efficiency
PROFANITY_PATTERNS = [re.compile(pattern, re.IGNORECASE) for pattern in PROFANITY_LIST]

def contains_profanity(text: str) -> bool:
    if not text:
        return False
    # Check against each pattern
    for pattern in PROFANITY_PATTERNS:
        if pattern.search(text):
            return True
    return False
