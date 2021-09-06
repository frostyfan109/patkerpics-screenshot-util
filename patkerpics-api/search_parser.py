import re

# If adding a qualifier, make sure to add to UserModel.get_qualifier_values()
qualifiers = {
    "tag": "string",
    "app": "string",
    "before": "date",
    "after": "date",
    "date": "date"
}
pattern = rf"\s*(?P<qualifier>{'|'.join(qualifiers)}):(?P<value>[^\s]*)"
js_pattern = rf"\s*(?<qualifier>{'|'.join(qualifiers)}):(?<value>[^\s]*)"


def search(string):
    match = re.search(pattern, string, re.IGNORECASE)
    groups = []
    while match is not None:
        groups.append([
            match.group("qualifier"),
            match.group("value")
        ])
        string = string.replace(match.group(0), "")
        match = re.search(pattern, string, re.IGNORECASE)

    return [string, groups]