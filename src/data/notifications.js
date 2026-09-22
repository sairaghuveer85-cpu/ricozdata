export const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-1',
    title: 'Policy Violation Detected',
    message: 'High risk column email flagged in Marketing Campaigns without required masking.',
    time: '12m ago',
    read: false,
    type: 'alert',
    link: '/governance'
  },
  {
    id: 'notif-2',
    title: 'Lineage Sync Completed',
    message: 'Snowflake to DBT pipeline lineage graph refreshed with 14 new downstream tables.',
    time: '45m ago',
    read: false,
    type: 'info',
    link: '/lineage'
  },
  {
    id: 'notif-3',
    title: 'Access Review Due',
    message: 'Quarterly access audit for Financial Transactions is scheduled for review.',
    time: '2h ago',
    read: true,
    type: 'warning',
    link: '/users'
  },
  {
    id: 'notif-4',
    title: 'Data Quality Check Passed',
    message: 'Customer Database scored 98% quality across all 5 verification dimensions.',
    time: '4h ago',
    read: true,
    type: 'success',
    link: '/quality'
  }
];
