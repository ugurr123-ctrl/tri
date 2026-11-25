import type {
  ExtensionSettings,
  Folder,
  Snippet,
  UsageStats,
} from '../types/extension';

export function createDefaultFolders(now = new Date().toISOString()): Folder[] {
  return [
    {
      id: 'fld_general',
      name: 'General',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'fld_support',
      name: 'Customer Support',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'fld_business',
      name: 'Business Emails',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function createDefaultSnippets(now = new Date().toISOString()): Snippet[] {
  return [
    {
      id: 'snp_thanks',
      name: 'Thank-You Reply',
      shortcut: '/thanks',
      content:
        'Thank you for reaching out! I really appreciate your message and will follow up with the next steps shortly.\n\nBest regards,\n{{cursor}}',
      folderId: 'fld_business',
      enabled: true,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      lastUsedAt: null,
    },
    {
      id: 'snp_meeting',
      name: 'Meeting Scheduling',
      shortcut: '/meet',
      content:
        'Hi {{cursor}},\n\nWould you have 20 minutes to connect later this week? Let me know two times that work best for your schedule and I will send over a calendar invite.\n\nThanks,',
      folderId: 'fld_business',
      enabled: true,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      lastUsedAt: null,
    },
    {
      id: 'snp_support_ack',
      name: 'Support Ticket Received',
      shortcut: '/ticket',
      content:
        'Hi there,\n\nThanks for contacting support on {{date}}. We have logged your request and our team is reviewing the details now. We will update you within one business day.\n\nBest,\nSupport Team',
      folderId: 'fld_support',
      enabled: true,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      lastUsedAt: null,
    },
    {
      id: 'snp_timestamp',
      name: 'Current Date & Time Stamp',
      shortcut: '/now',
      content: '{{date:YYYY-MM-DD}} {{time:24h}}',
      folderId: 'fld_general',
      enabled: true,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      lastUsedAt: null,
    },
    {
      id: 'snp_followup',
      name: 'Polite Follow-Up',
      shortcut: '/fup',
      content:
        'Hi {{cursor}},\n\nI wanted to quickly circle back on my previous note in case it got buried. Please let me know if you need any additional details from my side.\n\nWarm regards,',
      folderId: 'fld_business',
      enabled: true,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      lastUsedAt: null,
    },
  ];
}

export function createDefaultSettings(): ExtensionSettings {
  const now = new Date().toISOString();
  return {
    enabled: true,
    trigger: 'space',
    theme: 'system',
    excludedDomains: [],
    caseSensitiveShortcuts: false,
    showExpansionFeedback: true,
    customVariables: [
      {
        id: 'var_sender_name',
        key: 'name',
        label: 'Your Name',
        value: 'Alex Morgan',
        updatedAt: now,
      },
      {
        id: 'var_company',
        key: 'company',
        label: 'Company Name',
        value: 'Acme Studio',
        updatedAt: now,
      },
      {
        id: 'var_calendar',
        key: 'calendar_url',
        label: 'Scheduling Link',
        value: 'https://cal.example.com/alex',
        updatedAt: now,
      },
    ],
  };
}

export function createDefaultStats(): UsageStats {
  return {
    totalExpansions: 0,
    totalKeystrokesSaved: 0,
    dailyHistory: [],
    snippetStats: {},
  };
}
