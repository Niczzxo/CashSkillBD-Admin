// ─── CashSkillBD site config ─────────────────────────────────────
// দাম, নম্বর, শিডিউল বদলাতে শুধু এই ফাইলটা এডিট করলেই হবে।

export const CONFIG = {
  brand: 'CashSkillBD',
  tagline: 'Learn • Grow • Succeed',
  logoUrl:
    'https://sfkwnvekataedjqrsykn.supabase.co/storage/v1/object/public/cashskillbd/logo.png',
  fbPageUrl: 'https://www.facebook.com/Cashskill/',
  fbPageName: 'CashSkill BD',
  whatsapp: '01XXXXXXXXX',

  course: {
    name: 'সার্ভে মাস্টারি কোর্স',
    price: 1490,
    oldPrice: 2990,
    badge: 'সবচেয়ে জনপ্রিয়',
  },

  // পেমেন্ট মার্চেন্ট নম্বর (সেন্ড মানি)
  payments: {
    bkash: { label: 'বিকাশ', number: '01XXXXXXXXX', color: '#e2136e' },
    nagad: { label: 'নগদ', number: '01XXXXXXXXX', color: '#f6921e' },
    rocket: { label: 'রকেট', number: '01XXXXXXXXX', color: '#8c3494' },
  },

  seminar: {
    day: 'প্রতি শুক্রবার',
    time: 'রাত ৯টা',
    platform: 'Zoom লাইভ',
  },
};

export const fmt = (n) => '৳' + Number(n).toLocaleString('en-IN');
