function toCellValue(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return `'${value}`;
  return value === undefined || value === null ? '' : value;
}

const REQUIRED_HEADERS = {
  X: ['id', 'createdAt', 'postTo', 'contents', 'mediaUrls', 'postSchedule', 'inReplyToInternal', 'postId', 'inReplyToOnX', 'quoteId', 'repostTargetId', 'status', 'errorMessage'],
  Akira: ['id', 'createdAt', 'platform', 'accountId', 'contents', 'mediaUrls', 'postSchedule', 'crossPostGroupId', 'inReplyTo', 'status', 'postId', 'errorMessage'],
};

function createPostsDestinationAdapter(sheet, destinationKind) {
  return {
    appendIfAbsent(transferId, row) {
      const lastColumn = sheet.getLastColumn();
      const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
      const requiredHeaders = REQUIRED_HEADERS[destinationKind];
      if (!requiredHeaders || requiredHeaders.some((header) => !headers.includes(header))) {
        throw new Error('POSTS_HEADERS_INVALID');
      }
      const idColumn = headers.indexOf('id');
      if (idColumn === -1) throw new Error('POSTS_ID_HEADER_REQUIRED');
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const ids = sheet.getRange(2, idColumn + 1, lastRow - 1, 1).getValues().flat();
        if (ids.includes(transferId)) return false;
      }
      sheet.getRange(lastRow + 1, 1, 1, lastColumn)
        .setValues([headers.map((header) => toCellValue(row[header]))]);
      return true;
    },
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createPostsDestinationAdapter, REQUIRED_HEADERS };
}
