"""
Task Processors
Handles all text transformation operations.
"""


def process_task(operation: str, input_text: str) -> str:
    """
    Process input text based on the specified operation.

    Args:
        operation: One of 'uppercase', 'lowercase', 'reverse', 'wordcount'
        input_text: The text to process

    Returns:
        Processed result as a string

    Raises:
        ValueError: If operation is not recognized
    """
    processors = {
        "uppercase": _uppercase,
        "lowercase": _lowercase,
        "reverse": _reverse,
        "wordcount": _wordcount,
    }

    processor = processors.get(operation)
    if processor is None:
        raise ValueError(
            f"Unknown operation: '{operation}'. "
            f"Supported operations: {', '.join(processors.keys())}"
        )

    return processor(input_text)


def _uppercase(text: str) -> str:
    """Convert text to uppercase."""
    return text.upper()


def _lowercase(text: str) -> str:
    """Convert text to lowercase."""
    return text.lower()


def _reverse(text: str) -> str:
    """Reverse the text."""
    return text[::-1]


def _wordcount(text: str) -> str:
    """Count the number of words in the text."""
    words = text.split()
    count = len(words)
    return f"{count} word{'s' if count != 1 else ''}"
