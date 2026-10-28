import { describe, expect, it } from 'vitest';
import { kindFromMime, storagePath } from './api';

describe('kindFromMime', () => {
  it('maps photos, videos and PDFs', () => {
    expect(kindFromMime('image/jpeg')).toBe('photo');
    expect(kindFromMime('video/mp4')).toBe('video');
    expect(kindFromMime('application/pdf')).toBe('pdf');
    expect(kindFromMime('application/zip')).toBeNull();
  });
});

describe('storagePath', () => {
  it('starts with the org id and keeps a safe name', () => {
    expect(storagePath('org-1', 'photo', 'Ashoka Hall (Night).JPG', 42)).toBe(
      'org-1/photo/42-ashoka-hall-night.jpg',
    );
    expect(storagePath('org-1', 'pdf', '..pdf', 1)).toBe('org-1/pdf/1-file.pdf');
  });
});
