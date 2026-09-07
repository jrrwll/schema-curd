import { DISPLAY_NAME_MAX_LENGTH } from './constants';

export function physicalMetadataDisplayName(comment: string, name: string) {
  return Array.from(comment.trim() || name).slice(0, DISPLAY_NAME_MAX_LENGTH).join('');
}
