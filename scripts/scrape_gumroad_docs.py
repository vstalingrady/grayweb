import httpx
from bs4 import BeautifulSoup
import os
import re

def scrape_gumroad_docs():
    url = "https://gumroad.com/api"
    print(f"Fetching {url}...")
    
    try:
        response = httpx.get(url, follow_redirects=True)
        response.raise_for_status()
    except Exception as e:
        print(f"Error fetching URL: {e}")
        return

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Gumroad docs content is usually within a specific main section
    # Let's try to find the main content area. 
    # Based on the curl output, it seems to have headers and sections.
    
    sections = []
    
    # Find all headers which seem to define sections
    headers = soup.find_all(['h1', 'h2', 'h3'])
    
    output = "# Gumroad API Documentation (Auto-scraped)\n\n"
    
    # Simple strategy: iterate through children of the body and extract text/code
    # Actually, let's just get the text from the main article/content area if possible.
    main_content = soup.find('main') or soup.find('article') or soup.body
    
    if not main_content:
        print("Could not find main content area.")
        return

    # A more robust way is to look for div.prose or similar if they use it
    content_div = soup.find('div', class_=re.compile(r'prose|content|article'))
    if content_div:
        main_content = content_div

    for element in main_content.find_all(['h1', 'h2', 'h3', 'p', 'pre', 'ul', 'li']):
        if element.name == 'h1':
            output += f"# {element.get_text().strip()}\n\n"
        elif element.name == 'h2':
            output += f"## {element.get_text().strip()}\n\n"
        elif element.name == 'h3':
            output += f"### {element.get_text().strip()}\n\n"
        elif element.name == 'p':
            output += f"{element.get_text().strip()}\n\n"
        elif element.name == 'pre':
            code = element.get_text().strip()
            output += f"```\n{code}\n```\n\n"
        elif element.name == 'li':
            output += f"- {element.get_text().strip()}\n"
        
        # Add spacing after lists
        if element.name == 'li' and (not element.next_sibling or element.next_sibling.name != 'li'):
            output += "\n"

    # Save to file
    output_path = "docs/gumroad/api.md"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(output)
    
    print(f"Successfully scraped Gumroad docs to {output_path}")

if __name__ == "__main__":
    scrape_gumroad_docs()
