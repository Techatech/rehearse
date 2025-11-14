import { describe, it, expect } from 'vitest';
import { createDocumentService } from './document.service';
import * as fs from 'fs';
import * as path from 'path';

describe('DocumentService', () => {
  const documentService = createDocumentService();

  it('should parse plain text file', async () => {
    const buffer = Buffer.from('This is a test document with some content. It has multiple sentences.');
    const result = await documentService.parseDocument(buffer, 'txt');

    expect(result.text).toContain('This is a test document');
    expect(result.wordCount).toBeGreaterThan(5);
  });

  it('should parse markdown file', async () => {
    const markdown = `# Test Document\n\nThis is a **bold** text with some content.`;
    const buffer = Buffer.from(markdown);
    const result = await documentService.parseDocument(buffer, 'md');

    expect(result.text).toContain('Test Document');
    expect(result.wordCount).toBeGreaterThan(3);
  });

  it('should validate document - minimum length', () => {
    const parsed = {
      text: 'Short',
      wordCount: 1,
    };

    const validation = documentService.validateDocument(parsed);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Document content is too short (minimum 50 characters)');
  });

  it('should validate document - minimum words', () => {
    const parsed = {
      text: 'a b c d e f g h i',
      wordCount: 5,
    };

    const validation = documentService.validateDocument(parsed);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Document has too few words (minimum 10 words)');
  });

  it('should validate valid document', () => {
    const parsed = {
      text: 'This is a valid document with enough content to pass validation. It has multiple sentences and plenty of words to meet the minimum requirements for a valid document.',
      wordCount: 28,
    };

    const validation = documentService.validateDocument(parsed);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should extract sections from document text', () => {
    const text = `
REQUIREMENTS:
- 5+ years of experience
- Strong proficiency in TypeScript

RESPONSIBILITIES:
- Design and implement applications
- Lead technical decisions

QUALIFICATIONS:
- Bachelor's degree in CS
- Experience with microservices
`;

    const sections = documentService.extractSections(text);

    expect(sections.fullText).toContain('REQUIREMENTS');
    expect(sections.fullText).toContain('RESPONSIBILITIES');
    expect(sections.fullText).toContain('QUALIFICATIONS');
  });

  it('should handle unsupported file types', async () => {
    const buffer = Buffer.from('test');

    await expect(
      documentService.parseDocument(buffer, 'unsupported')
    ).rejects.toThrow('Unsupported file type');
  });

  it('should parse test resume file', async () => {
    const testFilePath = '/tmp/test-resume.txt';

    if (fs.existsSync(testFilePath)) {
      const buffer = fs.readFileSync(testFilePath);
      const result = await documentService.parseDocument(buffer, 'txt');

      expect(result.text).toContain('REQUIREMENTS');
      expect(result.wordCount).toBeGreaterThan(50);

      const validation = documentService.validateDocument(result);
      expect(validation.valid).toBe(true);
    }
  });
});
