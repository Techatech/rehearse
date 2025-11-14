import * as pdfjsLib from 'pdfjs-serverless';
import PizZip from 'pizzip';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt();

export interface ParsedDocument {
  text: string;
  pageCount?: number;
  wordCount: number;
}

export class DocumentService {
  /**
   * Parse document based on file type
   */
  async parseDocument(buffer: Buffer, fileType: string): Promise<ParsedDocument> {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return this.parsePDF(buffer);
      case 'docx':
      case 'doc':
        return this.parseDOCX(buffer);
      case 'txt':
        return this.parseTXT(buffer);
      case 'md':
      case 'markdown':
        return this.parseMarkdown(buffer);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  /**
   * Parse PDF file using pdfjs-serverless
   */
  private async parsePDF(buffer: Buffer): Promise<ParsedDocument> {
    try {
      // Convert Buffer to Uint8Array
      const uint8Array = new Uint8Array(buffer);

      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;

      // Extract text from all pages
      const textParts: string[] = [];
      const numPages = pdf.numPages;

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        textParts.push(pageText);
      }

      const text = textParts.join('\n').trim();

      return {
        text,
        pageCount: numPages,
        wordCount: this.countWords(text),
      };
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error('Failed to parse PDF file');
    }
  }

  /**
   * Parse DOCX file using PizZip
   * DOCX is a ZIP archive containing XML files
   */
  private async parseDOCX(buffer: Buffer): Promise<ParsedDocument> {
    try {
      // Load ZIP archive
      const zip = new PizZip(buffer);

      // DOCX main document is in word/document.xml
      const documentXml = zip.file('word/document.xml');

      if (!documentXml) {
        throw new Error('Invalid DOCX file: word/document.xml not found');
      }

      const xmlContent = documentXml.asText();

      // Extract text from XML
      // Text content is in <w:t> tags
      const textMatches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      const text = textMatches
        .map(match => {
          const innerMatch = match.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
          return innerMatch ? innerMatch[1] : '';
        })
        .join(' ')
        .trim();

      return {
        text,
        wordCount: this.countWords(text),
      };
    } catch (error) {
      console.error('DOCX parsing error:', error);
      throw new Error('Failed to parse DOCX file');
    }
  }

  /**
   * Parse plain text file
   */
  private parseTXT(buffer: Buffer): ParsedDocument {
    const text = buffer.toString('utf-8').trim();
    return {
      text,
      wordCount: this.countWords(text),
    };
  }

  /**
   * Parse Markdown file
   */
  private parseMarkdown(buffer: Buffer): ParsedDocument {
    const markdownText = buffer.toString('utf-8').trim();
    // Render markdown to HTML, then extract text
    const html = md.render(markdownText);
    // Simple HTML tag removal for text extraction
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    return {
      text: markdownText, // Return original markdown for better context
      wordCount: this.countWords(text),
    };
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Extract specific sections from document text
   */
  extractSections(text: string): {
    requirements?: string;
    responsibilities?: string;
    qualifications?: string;
    aboutCompany?: string;
    fullText: string;
  } {
    const sections: any = { fullText: text };

    // Common section headers patterns
    const patterns = {
      requirements: /(?:requirements?|what we(?:'re| are) looking for|must have|required skills?)[:\s]*\n([\s\S]*?)(?=\n\n[A-Z]|$)/i,
      responsibilities: /(?:responsibilities|duties|you will|what you(?:'ll| will) do|role)[:\s]*\n([\s\S]*?)(?=\n\n[A-Z]|$)/i,
      qualifications: /(?:qualifications?|skills?|experience|background)[:\s]*\n([\s\S]*?)(?=\n\n[A-Z]|$)/i,
      aboutCompany: /(?:about (?:us|the company)|company overview|who we are)[:\s]*\n([\s\S]*?)(?=\n\n[A-Z]|$)/i,
    };

    // Try to extract each section
    Object.entries(patterns).forEach(([key, pattern]) => {
      const match = text.match(pattern);
      if (match && match[1]) {
        sections[key] = match[1].trim();
      }
    });

    return sections;
  }

  /**
   * Validate document content
   */
  validateDocument(parsed: ParsedDocument): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!parsed.text || parsed.text.length < 50) {
      errors.push('Document content is too short (minimum 50 characters)');
    }

    if (parsed.text.length > 100000) {
      errors.push('Document content is too long (maximum 100,000 characters)');
    }

    if (parsed.wordCount < 10) {
      errors.push('Document has too few words (minimum 10 words)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton factory
export function createDocumentService(): DocumentService {
  return new DocumentService();
}
