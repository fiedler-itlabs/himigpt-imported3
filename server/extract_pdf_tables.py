#!/usr/bin/python3.11
"""
Extract text and tables from PDF using pdfplumber.
Returns JSON with pages, text content, and structured table data.
"""
import sys
import json
import pdfplumber
from typing import List, Dict, Any

def extract_pdf_content(pdf_path: str) -> Dict[str, Any]:
    """
    Extract content from PDF file.
    
    Returns:
    {
        "total_pages": int,
        "pages": [
            {
                "page_number": int,
                "text": str,
                "tables": [
                    {
                        "rows": [[cell, cell, ...], ...],
                        "headers": [str, ...] or null
                    }
                ]
            }
        ]
    }
    """
    result = {
        "total_pages": 0,
        "pages": []
    }
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            result["total_pages"] = len(pdf.pages)
            
            for page_num, page in enumerate(pdf.pages, start=1):
                page_data = {
                    "page_number": page_num,
                    "text": "",
                    "tables": []
                }
                
                # Extract text
                text = page.extract_text()
                if text:
                    page_data["text"] = text
                
                # Extract tables
                tables = page.extract_tables()
                if tables:
                    for table in tables:
                        # Filter out empty rows
                        filtered_rows = [
                            row for row in table 
                            if row and any(cell and str(cell).strip() for cell in row)
                        ]
                        
                        if filtered_rows:
                            # First row might be headers
                            headers = filtered_rows[0] if filtered_rows else None
                            table_data = {
                                "headers": headers,
                                "rows": filtered_rows
                            }
                            page_data["tables"].append(table_data)
                
                result["pages"].append(page_data)
        
        return result
    
    except Exception as e:
        return {
            "error": str(e),
            "total_pages": 0,
            "pages": []
        }

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: extract_pdf_tables.py <pdf_path>"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    result = extract_pdf_content(pdf_path)
    print(json.dumps(result, ensure_ascii=False, indent=2))
