import type { LibraryTemplate, TemplateCategory } from '../types/extension';

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  'customer-support': 'Customer Support',
  sales: 'Sales',
  ecommerce: 'E-commerce',
  freelancers: 'Freelancers',
  'business-emails': 'Business Emails',
  recruitment: 'Recruitment',
  'social-media': 'Social Media',
};

export const TEMPLATE_LIBRARY: LibraryTemplate[] = [
  // Customer Support
  {
    id: 'tpl_cs_ack',
    name: 'Ticket Acknowledgement',
    shortcut: '/csack',
    category: 'customer-support',
    description: 'Confirm receipt of a customer support request with current date.',
    tier: 'free',
    content:
      'Hi {{cursor}},\n\nThank you for reaching out on {{date}}. We have received your message and a specialist is reviewing your request right now. We will follow up with an update within 1 business day.\n\nBest regards,\nSupport Team',
  },
  {
    id: 'tpl_cs_troubleshoot',
    name: 'Request Diagnostic Details',
    shortcut: '/csdebug',
    category: 'customer-support',
    description: 'Ask customers for browser, steps to reproduce, and screenshots.',
    tier: 'free',
    content:
      'Thanks for flagging this issue. To help us investigate quickly, could you share:\n\n1. The browser and operating system you are using\n2. The exact steps that led to the issue\n3. A screenshot or error message if one appeared\n\nOnce we have those details, we will dig right in.',
  },
  {
    id: 'tpl_cs_refund',
    name: 'Refund Processed Notice',
    shortcut: '/csrefund',
    category: 'customer-support',
    description: 'Prompt for customer name and order number to confirm a processed refund.',
    tier: 'pro',
    content:
      'Hi {{input:Customer Name}},\n\nYour refund for order #{{input:Order Number}} has been processed on {{date}}. Depending on your payment provider, the funds typically appear on your statement within 5–7 business days.\n\nPlease reply here if you have any questions.\n\nBest,\n{{var:name}} · {{var:company}}',
  },
  {
    id: 'tpl_cs_escalate',
    name: 'Technical Escalation Update',
    shortcut: '/csesc',
    category: 'customer-support',
    description: 'Notify a customer that their ticket has been escalated to engineering.',
    tier: 'pro',
    content:
      'Hi {{input:Customer Name}},\n\nI have escalated case #{{input:Ticket ID}} to our engineering team for deeper investigation. We will send you the next update by {{input:Follow-up Time|default=tomorrow at 2:00 PM}}.\n\nThank you for your patience,\n{{var:name}}',
  },

  // Sales
  {
    id: 'tpl_sales_intro',
    name: 'Warm Outbound Introduction',
    shortcut: '/sintro',
    category: 'sales',
    description: 'Concise B2B introduction asking for a brief discovery call.',
    tier: 'free',
    content:
      'Hi {{cursor}},\n\nI noticed your team has been expanding recently and wanted to share how we help similar teams streamline recurring workflows without adding extra overhead.\n\nWould you be open to a brief 15-minute call next week to see if this is relevant?\n\nBest regards,',
  },
  {
    id: 'tpl_sales_followup',
    name: 'Post-Demo Recap',
    shortcut: '/sdemo',
    category: 'sales',
    description: 'Recap key discussion points and next steps after a product demo.',
    tier: 'free',
    content:
      'Hi {{cursor}},\n\nThank you for taking the time to walk through the platform today ({{date}}). As discussed, here are the key takeaways and next steps:\n\n- Primary goal: \n- Timeline: \n- Next step: \n\nLet me know if any other stakeholders should join our follow-up.\n\nBest,',
  },
  {
    id: 'tpl_sales_pricing',
    name: 'Custom Proposal Follow-Up',
    shortcut: '/squote',
    category: 'sales',
    description: 'Share tailored pricing details with interactive prospect and plan fields.',
    tier: 'pro',
    content:
      'Hi {{input:Prospect Name}},\n\nFollowing up on our conversation, I have prepared the {{input:Plan Tier|default=Team}} proposal for {{input:Company Name}}.\n\nYou can book a quick Q&A slot directly on my calendar here: {{var:calendar_url}}\n\nLooking forward to your thoughts,\n{{var:name}} · {{var:company}}',
  },
  {
    id: 'tpl_sales_checkin',
    name: 'Quarterly Account Check-In',
    shortcut: '/scheck',
    category: 'sales',
    description: 'Proactive check-in for active prospects or renewals.',
    tier: 'pro',
    content:
      'Hi {{input:Contact Name}},\n\nChecking in from {{var:company}} as we head into the new month. How is everything going with {{input:Project Name}}? Happy to hop on a quick call if priorities have shifted.\n\nBest,\n{{var:name}}',
  },

  // E-commerce
  {
    id: 'tpl_ecom_shipping',
    name: 'Shipping Confirmation',
    shortcut: '/ecship',
    category: 'ecommerce',
    description: 'Inform buyers that their order is on its way with cursor at tracking number.',
    tier: 'free',
    content:
      'Great news! Your order has shipped on {{date}}.\n\nTracking number: {{cursor}}\n\nCarrier updates can take up to 24 hours to appear. Thank you for shopping with us!',
  },
  {
    id: 'tpl_ecom_return',
    name: 'Return Policy & Instructions',
    shortcut: '/ecret',
    category: 'ecommerce',
    description: 'Clear step-by-step return instructions for online shoppers.',
    tier: 'free',
    content:
      'We are happy to help with your return. Items in unused condition can be returned within 30 days of delivery.\n\nPlease reply with your order number and the item(s) you wish to send back, and we will generate your prepaid return label right away.',
  },
  {
    id: 'tpl_ecom_delay',
    name: 'Carrier Delay Apology',
    shortcut: '/ecdelay',
    category: 'ecommerce',
    description: 'Proactive delay update using order number and revised delivery estimate.',
    tier: 'pro',
    content:
      'Hi {{input:Customer Name}},\n\nWe noticed a slight carrier delay on order #{{input:Order Number}}. The updated delivery window is {{input:Estimated Delivery}}. We are monitoring the shipment closely and will notify you as soon as it arrives.\n\nThank you for your patience,\n{{var:company}} Care Team',
  },
  {
    id: 'tpl_ecom_review',
    name: 'Post-Delivery Review Request',
    shortcut: '/ecrev',
    category: 'ecommerce',
    description: 'Friendly review request after successful product delivery.',
    tier: 'pro',
    content:
      'Hi {{input:Customer Name}},\n\nWe hope you are enjoying your {{input:Product Name}}! If you have 30 seconds, sharing a quick review helps other shoppers and our small team at {{var:company}} immensely.\n\nThank you for your support!',
  },

  // Freelancers
  {
    id: 'tpl_free_avail',
    name: 'Project Availability Reply',
    shortcut: '/favail',
    category: 'freelancers',
    description: 'Respond to inbound client inquiries with current booking availability.',
    tier: 'free',
    content:
      'Hi {{cursor}},\n\nThank you for reaching out about this project! I currently have availability starting next month and would love to learn more about your scope, timeline, and target budget.\n\nWould you like to schedule a quick 15-minute intro call?\n\nBest,',
  },
  {
    id: 'tpl_free_invoice',
    name: 'Invoice Sent Note',
    shortcut: '/finv',
    category: 'freelancers',
    description: 'Polite email accompanying a milestone or monthly invoice.',
    tier: 'free',
    content:
      'Hi {{cursor}},\n\nPlease find attached the invoice dated {{date}} for our recent work together. Payment is due within 14 days via the details listed on the invoice.\n\nLet me know if you need any extra paperwork for your accounting team.\n\nThank you!',
  },
  {
    id: 'tpl_free_scope',
    name: 'Scope Change Clarification',
    shortcut: '/fscope',
    category: 'freelancers',
    description: 'Outline an out-of-scope addition with transparent time and fee estimate.',
    tier: 'pro',
    content:
      'Hi {{input:Client Name}},\n\nI would be glad to add {{input:Requested Feature}} to the project. Because this sits outside our original agreement, it will add approximately {{input:Additional Hours|default=4 hours}} ({{input:Additional Fee}}) and shift delivery by {{input:Timeline Shift|default=2 business days}}.\n\nReply "Approved" if you would like me to proceed.\n\nBest,\n{{var:name}}',
  },
  {
    id: 'tpl_free_proposal',
    name: 'Proposal Delivery Email',
    shortcut: '/fprop',
    category: 'freelancers',
    description: 'Send a structured project proposal with your scheduling link.',
    tier: 'pro',
    content:
      'Hi {{input:Client Name}},\n\nAttached is the proposal for {{input:Project Title}}, including milestones, deliverables, and pricing. Feel free to review at your convenience or book a walkthrough here: {{var:calendar_url}}\n\nBest regards,\n{{var:name}}',
  },

  // Business Emails
  {
    id: 'tpl_biz_ooo',
    name: 'Out of Office Notice',
    shortcut: '/ooo',
    category: 'business-emails',
    description: 'Clear out-of-office reply with return date cursor placement.',
    tier: 'free',
    content:
      'Thank you for your email. I am currently out of the office with limited access to email and will return on {{cursor}}.\n\nI will respond to your message as soon as I am back. For urgent matters, please contact our main team inbox.\n\nBest regards,',
  },
  {
    id: 'tpl_biz_handoff',
    name: 'Colleague Introduction & Handoff',
    shortcut: '/handoff',
    category: 'business-emails',
    description: 'Smoothly introduce a teammate who will take over an email thread.',
    tier: 'free',
    content:
      'Hi {{cursor}},\n\nLooping in my colleague who is best positioned to assist you from here. They have full context on our conversation and will follow up shortly.\n\nMoving myself to BCC to keep your inbox clean.\n\nBest regards,',
  },
  {
    id: 'tpl_biz_agenda',
    name: 'Meeting Agenda Pre-Read',
    shortcut: '/agenda',
    category: 'business-emails',
    description: 'Share a crisp structured agenda ahead of a scheduled call.',
    tier: 'pro',
    content:
      'Hi everyone,\n\nAhead of our {{input:Meeting Title}} on {{date}}, here is our brief agenda:\n\n1. Status review ({{input:Topic 1}})\n2. Key decisions ({{input:Topic 2}})\n3. Owners & next deadlines\n\nSee you at {{time}}.\n\nBest,\n{{var:name}}',
  },
  {
    id: 'tpl_biz_exec',
    name: 'Weekly Executive Status',
    shortcut: '/status',
    category: 'business-emails',
    description: 'Concise weekly progress summary formatted for leadership.',
    tier: 'pro',
    content:
      'Weekly Update — {{date:long}}\n\nCompleted:\n- {{input:Top Win}}\n\nIn Progress:\n- {{input:Current Priority}}\n\nBlockers / Decisions Needed:\n- {{input:Blocker|default=None}}\n\n— {{var:name}} ({{var:company}})',
  },

  // Recruitment
  {
    id: 'tpl_rec_interview',
    name: 'Interview Invitation',
    shortcut: '/rinvite',
    category: 'recruitment',
    description: 'Invite a candidate to book an interview slot.',
    tier: 'free',
    content:
      'Hi {{cursor}},\n\nThank you for applying! We were impressed by your background and would love to invite you to a 30-minute introductory interview.\n\nPlease share 2–3 times that work for you over the next few days, and I will send a calendar invite with the video link.\n\nBest regards,',
  },
  {
    id: 'tpl_rec_reject',
    name: 'Respectful Candidate Decline',
    shortcut: '/rdecline',
    category: 'recruitment',
    description: 'Kind, professional update when moving forward with other applicants.',
    tier: 'free',
    content:
      'Hi {{cursor}},\n\nThank you for taking the time to apply and speak with our team. While we were genuinely impressed by your experience, we have decided to move forward with other candidates whose background more closely matches our current needs.\n\nWe appreciate your interest and wish you every success in your search.\n\nWarm regards,',
  },
  {
    id: 'tpl_rec_outreach',
    name: 'Passive Candidate Outreach',
    shortcut: '/rreach',
    category: 'recruitment',
    description: 'Personalized sourcing message for LinkedIn or email.',
    tier: 'pro',
    content:
      'Hi {{input:Candidate Name}},\n\nI came across your profile and was impressed by your work in {{input:Specialty}}. We are hiring a {{input:Role Title}} at {{var:company}} and think your experience could be a strong match.\n\nWould you be open to a casual 15-minute chat? You can grab a slot here: {{var:calendar_url}}\n\nBest,\n{{var:name}}',
  },
  {
    id: 'tpl_rec_offer',
    name: 'Verbal Offer Follow-Up',
    shortcut: '/roffer',
    category: 'recruitment',
    description: 'Summary note confirming verbal offer details and start date.',
    tier: 'pro',
    content:
      'Hi {{input:Candidate Name}},\n\nWe are thrilled to formally extend our offer for the {{input:Role Title}} position at {{var:company}}, with a target start date of {{input:Start Date}}.\n\nYour written offer packet is on its way separately. Please reach out with any questions!\n\nWarmly,\n{{var:name}}',
  },

  // Social Media
  {
    id: 'tpl_soc_collab',
    name: 'Creator Collaboration Reply',
    shortcut: '/smcollab',
    category: 'social-media',
    description: 'Respond to partnership or sponsorship DMs professionally.',
    tier: 'free',
    content:
      'Hey {{cursor}}! Thanks so much for reaching out about a potential collaboration. Could you share your media kit, audience overview, and campaign goals via email so our team can review properly? Excited to learn more!',
  },
  {
    id: 'tpl_soc_dm',
    name: 'Helpful Community DM Reply',
    shortcut: '/smdm',
    category: 'social-media',
    description: 'Friendly direct message response pointing followers to details.',
    tier: 'free',
    content:
      'Thanks for the message! Happy to help with that — you can find all the details right here: {{cursor}}\n\nLet me know if anything else comes up!',
  },
  {
    id: 'tpl_soc_launch',
    name: 'Product Launch Announcement',
    shortcut: '/smlaunch',
    category: 'social-media',
    description: 'Structured launch post draft with product and benefit prompts.',
    tier: 'pro',
    content:
      'Today ({{date}}) we are launching {{input:Feature or Product Name}} at {{var:company}}!\n\nBuilt to help you {{input:Core Benefit}} without the usual friction.\n\nCheck it out and tell us what you think: {{input:Launch URL}}',
  },
  {
    id: 'tpl_soc_credit',
    name: 'Repost Permission Request',
    shortcut: '/smcredit',
    category: 'social-media',
    description: 'Ask a creator for permission to reshare their post with full credit.',
    tier: 'pro',
    content:
      'Hi {{input:Creator Handle}}! We loved your recent post about {{input:Topic}}. Would we have your permission to reshare it on the {{var:company}} page with full credit and tag? Thank you!',
  },
];
