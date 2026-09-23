/**
 * Centralized Data Formatters for RicozData
 * Formats row counts, storage bytes, quality percentages, dates, and currency.
 */

export function formatNumber(num) {
  if (num === null || num === undefined) return '-';
  if (typeof num === 'string') return num;
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatCompactNumber(number) {
  if (number === null || number === undefined) return '0';
  const num = typeof number === 'string' ? parseFloat(number.replace(/[^0-9.-]+/g, '')) : number;
  if (isNaN(num)) return String(number);
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
}

export function formatRows(rowCount) {
  if (rowCount === null || rowCount === undefined) return '-';
  if (typeof rowCount === 'string') return rowCount;
  return formatCompactNumber(rowCount);
}

export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatQuality(score) {
  if (score === null || score === undefined) return '-';
  const val = typeof score === 'string' ? parseFloat(score) : score;
  return `${Math.round(val)}%`;
}

export function formatPercentage(val, includeSign = false) {
  if (val === null || val === undefined) return '-';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  const sign = includeSign && num > 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}%`;
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return String(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return String(timestamp);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} days ago`;
  return formatDate(timestamp);
}

export function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0][0].toUpperCase();
}
