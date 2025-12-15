#!/usr/bin/env python3
"""
Comprehensive Paddle API documentation scraper.
Crawls all sections and saves to organized markdown files.
"""

import requests
from bs4 import BeautifulSoup
from pathlib import Path
import time
from urllib.parse import urljoin, urlparse
import re
from collections import defaultdict

# Configuration
BASE_URL = "https://developer.paddle.com"
OUTPUT_DIR = Path(__file__).parent.parent / "docs" / "paddle-api"
DELAY_BETWEEN_REQUESTS = 0.3  # seconds

# Main sections to crawl
MAIN_SECTIONS = [
    "/webhooks/overview",
    "/errors/overview",
    "/build/overview",
    "/concepts/overview",
    "/paddlejs/overview",
    "/changelog/overview",
    "/resources/overview",
    "/migrate/overview",
    "/api-reference/overview",
]

# Track visited URLs to avoid duplicates
visited_urls = set()
all_links = defaultdict(list)


def fetch_page(url):
    """Fetch a page and return BeautifulSoup object."""
    try:
        print(f"Fetching: {url}")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return BeautifulSoup(response.text, 'html.parser')
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return None


def extract_nav_links(soup, base_url):
    """Extract all relevant links from a page."""
    links = []
    
    # Get the current section from base_url
    current_section = get_section_name(base_url)
    if current_section == "other":
        return []
        
    print(f"  🔍 Extracting links for section: {current_section}")
    
    # Find all links in the page
    for link in soup.find_all('a', href=True):
        href = link['href']
        
        # Handle relative URLs
        absolute_url = urljoin(base_url, href)
        
        # Check if it belongs to the same domain
        if 'developer.paddle.com' not in absolute_url:
            continue
            
        # Check if it belongs to the same section
        # e.g. /api-reference/ should only crawl /api-reference/ links
        path = urlparse(absolute_url).path
        if not path.startswith(f"/{current_section}/"):
            continue
            
        # Clean URL (remove fragments and queries)
        clean_url = absolute_url.split('#')[0].split('?')[0]
        
        if clean_url and clean_url not in visited_urls:
            links.append(clean_url)
    
    unique_links = list(set(links))
    print(f"  Found {len(unique_links)} new links to crawl")
    return unique_links


def html_to_markdown(soup):
    """Convert BeautifulSoup content to markdown."""
    if not soup:
        return ""
    
    # Remove script and style elements
    for element in soup(['script', 'style', 'nav', 'header', 'footer']):
        element.decompose()
    
    markdown = []
    
    # Get the main content area
    main_content = (
        soup.find('main') or 
        soup.find('article') or 
        soup.find(class_=re.compile(r'content|main|article', re.I)) or
        soup.find('body')
    )
    
    if not main_content:
        return soup.get_text(separator='\n', strip=True)
    
    # Process elements
    for element in main_content.descendants:
        if element.name is None:  # Text node
            continue
            
        # Headers
        if element.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            level = int(element.name[1])
            text = element.get_text(strip=True)
            if text:
                markdown.append(f"\n{'#' * level} {text}\n")
        
        # Paragraphs
        elif element.name == 'p':
            text = element.get_text(strip=True)
            if text:
                markdown.append(f"\n{text}\n")
        
        # Code blocks
        elif element.name == 'pre':
            code = element.find('code')
            if code:
                # Try to detect language
                language = ''
                if code.get('class'):
                    for cls in code['class']:
                        if cls.startswith('language-'):
                            language = cls.replace('language-', '')
                            break
                
                code_text = code.get_text()
                markdown.append(f"\n```{language}\n{code_text}\n```\n")
        
        # Inline code
        elif element.name == 'code' and element.parent.name != 'pre':
            text = element.get_text(strip=True)
            if text and not any(text in m for m in markdown[-3:] if markdown):
                markdown.append(f"`{text}`")
        
        # Links
        elif element.name == 'a':
            text = element.get_text(strip=True)
            href = element.get('href', '')
            if text and href:
                markdown.append(f"[{text}]({href})")
        
        # Lists
        elif element.name == 'li' and element.parent.name in ['ul', 'ol']:
            # Only process direct li children to avoid nesting issues
            if element.find_parent(['li']) is None or element.parent.parent.name not in ['ul', 'ol']:
                text = element.get_text(strip=True)
                if text:
                    prefix = '-' if element.parent.name == 'ul' else '1.'
                    markdown.append(f"{prefix} {text}")
        
        # Tables
        elif element.name == 'table':
            table_md = process_table(element)
            if table_md:
                markdown.append(f"\n{table_md}\n")
        
        # Blockquotes
        elif element.name == 'blockquote':
            text = element.get_text(strip=True)
            if text:
                lines = text.split('\n')
                for line in lines:
                    markdown.append(f"> {line}")
                markdown.append("")
    
    return '\n'.join(markdown)


def process_table(table):
    """Convert HTML table to markdown table."""
    rows = []
    
    # Get headers
    headers = []
    thead = table.find('thead')
    if thead:
        header_row = thead.find('tr')
        if header_row:
            headers = [th.get_text(strip=True) for th in header_row.find_all(['th', 'td'])]
    
    # If no thead, try first row
    if not headers:
        first_row = table.find('tr')
        if first_row:
            cells = first_row.find_all(['th', 'td'])
            if cells and cells[0].name == 'th':
                headers = [cell.get_text(strip=True) for cell in cells]
    
    if headers:
        rows.append("| " + " | ".join(headers) + " |")
        rows.append("| " + " | ".join(["---"] * len(headers)) + " |")
    
    # Get body rows
    tbody = table.find('tbody') or table
    for tr in tbody.find_all('tr'):
        # Skip if this was the header row
        if headers and tr.find('th'):
            continue
        
        cells = [td.get_text(strip=True) for td in tr.find_all(['td', 'th'])]
        if cells:
            rows.append("| " + " | ".join(cells) + " |")
    
    return '\n'.join(rows) if rows else ""


def get_section_name(url):
    """Extract section name from URL."""
    path = urlparse(url).path.strip('/')
    
    # Get the first part of the path as the section
    parts = path.split('/')
    if parts:
        return parts[0]
    return "other"


def get_filename_from_url(url):
    """Generate a filename from URL."""
    path = urlparse(url).path.strip('/')
    
    # Replace slashes with hyphens, remove file extensions
    filename = path.replace('/', '-')
    
    # Clean up
    filename = re.sub(r'[^\w\-]', '', filename)
    
    # Add .md extension
    if not filename.endswith('.md'):
        filename += '.md'
    
    return filename


def scrape_page(url):
    """Scrape a single page and save to markdown."""
    if url in visited_urls:
        return []
    
    visited_urls.add(url)
    
    soup = fetch_page(url)
    if not soup:
        return []
    
    # Extract navigation links for crawling
    nav_links = extract_nav_links(soup, url)
    
    # Convert content to markdown
    title = soup.find('title')
    title_text = title.get_text() if title else "Paddle Documentation"
    
    h1 = soup.find('h1')
    h1_text = h1.get_text(strip=True) if h1 else title_text
    
    markdown_content = html_to_markdown(soup)
    
    # Create document with metadata
    document = f"""# {h1_text}

**Source:** {url}

---

{markdown_content}

---

*Last scraped: {time.strftime('%Y-%m-%d %H:%M:%S')}*
"""
    
    # Determine section and save
    section = get_section_name(url)
    filename = get_filename_from_url(url)
    
    # Create section directory
    section_dir = OUTPUT_DIR / section
    section_dir.mkdir(parents=True, exist_ok=True)
    
    # Save file
    output_path = section_dir / filename
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(document)
    
    print(f"  ✅ Saved: {output_path}")
    
    # Track links by section
    all_links[section].append(url)
    
    return nav_links


def crawl_section(start_url):
    """Crawl a documentation section starting from an overview page."""
    to_visit = [start_url]
    section = get_section_name(start_url)
    
    print(f"\n{'='*60}")
    print(f"Crawling section: {section}")
    print(f"{'='*60}")
    
    while to_visit:
        url = to_visit.pop(0)
        
        # Only crawl URLs within the same section
        if get_section_name(url) != section:
            continue
        
        # Add delay to be polite
        time.sleep(DELAY_BETWEEN_REQUESTS)
        
        # Scrape page and get new links
        new_links = scrape_page(url)
        
        # Add new links to visit queue
        for link in new_links:
            if link not in visited_urls and link not in to_visit:
                if get_section_name(link) == section:
                    to_visit.append(link)
    
    print(f"\n✅ Completed section: {section} ({len(all_links[section])} pages)\n")


def create_index():
    """Create index files for each section and a master index."""
    print("\n" + "="*60)
    print("Creating index files...")
    print("="*60)
    
    master_index = """# Paddle Developer Documentation

This documentation was automatically scraped from [developer.paddle.com](https://developer.paddle.com).

## Sections

"""
    
    # Create index for each section
    for section in sorted(all_links.keys()):
        section_dir = OUTPUT_DIR / section
        urls = all_links[section]
        
        # Create section index
        section_index = f"""# {section.replace('-', ' ').title()} Documentation

Total pages: {len(urls)}

## Pages

"""
        
        # List all pages in this section
        for url in sorted(urls):
            filename = get_filename_from_url(url)
            title = filename.replace('.md', '').replace('-', ' ').title()
            section_index += f"- [{title}](./{filename})\n"
        
        section_index += f"\n---\n\n[← Back to main index](../INDEX.md)\n"
        
        # Save section index
        with open(section_dir / "INDEX.md", 'w', encoding='utf-8') as f:
            f.write(section_index)
        
        print(f"  ✅ Created index for {section}")
        
        # Add to master index
        master_index += f"### [{section.replace('-', ' ').title()}](./{section}/INDEX.md)\n\n"
        master_index += f"{len(urls)} pages\n\n"
    
    master_index += f"\n---\n\n*Last updated: {time.strftime('%Y-%m-%d %H:%M:%S')}*\n"
    
    # Save master index
    with open(OUTPUT_DIR / "INDEX.md", 'w', encoding='utf-8') as f:
        f.write(master_index)
    
    print(f"\n  ✅ Created master index: {OUTPUT_DIR / 'INDEX.md'}")


def main():
    """Main function."""
    print("="*60)
    print("Paddle Documentation Scraper")
    print("="*60)
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Sections to scrape: {len(MAIN_SECTIONS)}")
    print()
    
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Crawl each main section
    for section_url in MAIN_SECTIONS:
        full_url = BASE_URL + section_url
        crawl_section(full_url)
    
    # Create indexes
    create_index()
    
    # Summary
    print("\n" + "="*60)
    print("SCRAPING COMPLETE")
    print("="*60)
    print(f"Total sections: {len(all_links)}")
    print(f"Total pages: {sum(len(urls) for urls in all_links.values())}")
    print(f"Output: {OUTPUT_DIR}")
    print()


if __name__ == "__main__":
    main()
