export type EventCategory = 'Global Holidays' | 'Marketing Events' | 'Social Media Days' | 'Stock Content Ideas' | 'Religious Events' | 'National Days' | 'Custom';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  category: EventCategory;
  description?: string;
  country?: string;
  isCustom?: boolean;
}

export const baseEvents: CalendarEvent[] = [
  // User Provided Events - JAN
  { id: 'usr-01-01', title: "New Year's Day", date: '2026-01-01', category: 'Global Holidays' },
  { id: 'usr-01-02', title: "Science Fiction Day", date: '2026-01-02', category: 'Social Media Days' },
  { id: 'usr-01-05', title: "National Bird Day", date: '2026-01-05', category: 'Global Holidays' },
  { id: 'usr-01-06', title: "Epiphany/Three Kings Day", date: '2026-01-06', category: 'Religious Events' },
  { id: 'usr-01-15-a', title: "Martin Luther King Jr. Day", date: '2026-01-15', category: 'National Days', country: 'USA' },
  { id: 'usr-01-15-b', title: "Blue Monday (3rd Monday of January)", date: '2026-01-15', category: 'Social Media Days' },
  { id: 'usr-01-19', title: "National Popcorn Day", date: '2026-01-19', category: 'Social Media Days' },
  { id: 'usr-01-20', title: "Cheese Lover's Day", date: '2026-01-20', category: 'Social Media Days' },
  { id: 'usr-01-26', title: "Australia Day", date: '2026-01-26', category: 'National Days', country: 'Australia' },
  { id: 'usr-01-27', title: "International Holocaust Remembrance Day", date: '2026-01-27', category: 'Global Holidays' },
  { id: 'usr-01-30', title: "National Croissant Day", date: '2026-01-30', category: 'Social Media Days' },

  // FEB
  { id: 'usr-02-01', title: "Start of Black History Month", date: '2026-02-01', category: 'Global Holidays' },
  { id: 'usr-02-02', title: "Groundhog Day", date: '2026-02-02', category: 'Global Holidays' },
  { id: 'usr-02-04', title: "World Cancer Day", date: '2026-02-04', category: 'Global Holidays' },
  { id: 'usr-02-09', title: "National Pizza Day", date: '2026-02-09', category: 'Social Media Days' },
  { id: 'usr-02-10', title: "Chinese New Year (2026)", date: '2026-02-10', category: 'Global Holidays' },
  { id: 'usr-02-11', title: "International Day of Women and Girls in Science", date: '2026-02-11', category: 'Global Holidays' },
  { id: 'usr-02-13-a', title: "World Radio Day", date: '2026-02-13', category: 'Global Holidays' },
  { id: 'usr-02-13-b', title: "Super Bowl Sunday (2026)", date: '2026-02-13', category: 'Marketing Events', country: 'USA' },
  { id: 'usr-02-14', title: "Valentine's Day", date: '2026-02-14', category: 'Global Holidays' },
  { id: 'usr-02-20', title: "World Day of Social Justice", date: '2026-02-20', category: 'Global Holidays' },
  { id: 'usr-02-21', title: "Carnival / Mardi Gras (2026)", date: '2026-02-21', category: 'Global Holidays' },
  { id: 'usr-02-27', title: "International Polar Bear Day", date: '2026-02-27', category: 'Global Holidays' },
  { id: 'bd-1', title: "International Mother Language Day", date: '2026-02-21', category: 'Global Holidays', country: 'BD' }, // Retained BD day which aligns perfectly

  // MAR
  { id: 'usr-03-01-a', title: "Martisor (Romania & Moldova tradition)", date: '2026-03-01', category: 'Global Holidays' },
  { id: 'usr-03-01-b', title: "Employee Appreciation Day", date: '2026-03-01', category: 'Marketing Events' },
  { id: 'usr-03-01-c', title: "Women's History Month begins", date: '2026-03-01', category: 'Global Holidays' },
  { id: 'usr-03-02', title: "Read Across America Day", date: '2026-03-02', category: 'Social Media Days' },
  { id: 'usr-03-03', title: "World Wildlife Day", date: '2026-03-03', category: 'Global Holidays' },
  { id: 'usr-03-04', title: "National Napping Day", date: '2026-03-04', category: 'Social Media Days' },
  { id: 'usr-03-08', title: "International Women's Day", date: '2026-03-08', category: 'Global Holidays' },
  { id: 'usr-03-12', title: "Ramadan begins (2026)", date: '2026-03-12', category: 'Religious Events' },
  { id: 'usr-03-14-a', title: "Pi Day", date: '2026-03-14', category: 'Social Media Days' },
  { id: 'usr-03-14-b', title: "World Kidney Day", date: '2026-03-14', category: 'Global Holidays' },
  { id: 'usr-03-15', title: "World Sleep Day", date: '2026-03-15', category: 'Global Holidays' },
  { id: 'usr-03-17', title: "St. Patrick's Day", date: '2026-03-17', category: 'Global Holidays' },
  { id: 'usr-03-19', title: "Spring Equinox & Nowruz (2026)", date: '2026-03-19', category: 'Global Holidays' },
  { id: 'usr-03-20', title: "World Oral Health Day", date: '2026-03-20', category: 'Global Holidays' },
  { id: 'usr-03-21', title: "Day for the Elimination of Racial Discrimination", date: '2026-03-21', category: 'Global Holidays' },
  { id: 'usr-03-22', title: "World Water Day", date: '2026-03-22', category: 'Global Holidays' },
  { id: 'usr-03-23', title: "Pakistan Day", date: '2026-03-23', category: 'National Days', country: 'Pakistan' },
  { id: 'usr-03-24-a', title: "Palm Sunday (2026)", date: '2026-03-24', category: 'Religious Events' },
  { id: 'usr-03-24-b', title: "World TB Day", date: '2026-03-24', category: 'Global Holidays' },
  { id: 'usr-03-25-a', title: "Holi (2026)", date: '2026-03-25', category: 'Religious Events' },
  { id: 'usr-03-25-b', title: "Remembrance of Slavery Victims", date: '2026-03-25', category: 'Global Holidays' },
  { id: 'usr-03-26-a', title: "Earth Hour", date: '2026-03-26', category: 'Global Holidays' },
  { id: 'usr-03-29', title: "Good Friday (2026)", date: '2026-03-29', category: 'Religious Events' },
  { id: 'usr-03-30', title: "National Doctors' Day", date: '2026-03-30', category: 'Global Holidays' },
  { id: 'usr-03-31', title: "Easter Sunday (2026)", date: '2026-03-31', category: 'Religious Events' },
  { id: 'bd-2', title: "Independence Day (Bangladesh)", date: '2026-03-26', category: 'National Days', country: 'BD' }, // Retained BD day

  // APR
  { id: 'usr-04-01', title: "April Fools' Day", date: '2026-04-01', category: 'Social Media Days' },
  { id: 'usr-04-02', title: "World Autism Awareness Day", date: '2026-04-02', category: 'Global Holidays' },
  { id: 'usr-04-07', title: "World Health Day", date: '2026-04-07', category: 'Global Holidays' },
  { id: 'usr-04-10', title: "Eid al-Fitr (2026)", date: '2026-04-10', category: 'Religious Events' },
  { id: 'usr-04-11', title: "World Parkinson's Day", date: '2026-04-11', category: 'Global Holidays' },
  { id: 'usr-04-14', title: "Pan American Day", date: '2026-04-14', category: 'Global Holidays' },
  { id: 'usr-04-15', title: "World Art Day", date: '2026-04-15', category: 'Global Holidays' },
  { id: 'usr-04-17', title: "World Hemophilia Day", date: '2026-04-17', category: 'Global Holidays' },
  { id: 'usr-04-18-a', title: "World Heritage Day", date: '2026-04-18', category: 'Global Holidays' },
  { id: 'usr-04-18-b', title: "Int. Day for Monuments and Sites", date: '2026-04-18', category: 'Global Holidays' },
  { id: 'usr-04-22', title: "Earth Day", date: '2026-04-22', category: 'Global Holidays' },
  { id: 'usr-04-23', title: "World Book Day", date: '2026-04-23', category: 'Global Holidays' },
  { id: 'usr-04-25-a', title: "World Malaria Day", date: '2026-04-25', category: 'Global Holidays' },
  { id: 'usr-04-25-b', title: "Anzac Day", date: '2026-04-25', category: 'National Days', country: 'Australia/NZ' },
  { id: 'usr-04-28', title: "World Day for Safety and Health at Work", date: '2026-04-28', category: 'Global Holidays' },
  { id: 'usr-04-29', title: "International Dance Day", date: '2026-04-29', category: 'Global Holidays' },
  { id: 'usr-04-30', title: "International Jazz Day", date: '2026-04-30', category: 'Global Holidays' },
  { id: 'bd-3', title: "Pohela Boishakh (Bengali New Year)", date: '2026-04-14', category: 'National Days', country: 'BD' }, // Retained BD day

  // MAY
  { id: 'usr-05-01', title: "International Workers' Day / Labour Day", date: '2026-05-01', category: 'Global Holidays' },
  { id: 'usr-05-03', title: "National Space Day", date: '2026-05-03', category: 'Global Holidays' },
  { id: 'usr-05-04', title: "Greenery Day (Japan)", date: '2026-05-04', category: 'National Days', country: 'Japan' },
  { id: 'usr-05-07', title: "National Teacher Appreciation Day", date: '2026-05-07', category: 'Global Holidays' },
  { id: 'usr-05-12', title: "Mother's Day (2026)", date: '2026-05-12', category: 'Global Holidays' },
  { id: 'usr-05-15', title: "International Day of Families", date: '2026-05-15', category: 'Global Holidays' },
  { id: 'usr-05-17', title: "World Telecommunication / Internet Day", date: '2026-05-17', category: 'Global Holidays' },
  { id: 'usr-05-22', title: "International Day for Biological Diversity", date: '2026-05-22', category: 'Global Holidays' },
  { id: 'usr-05-27', title: "Memorial Day (2026)", date: '2026-05-27', category: 'National Days', country: 'USA' },
  { id: 'usr-05-31', title: "World No Tobacco Day", date: '2026-05-31', category: 'Global Holidays' },

  // JUN
  { id: 'usr-06-01', title: "Global Day of Parents", date: '2026-06-01', category: 'Global Holidays' },
  { id: 'usr-06-05', title: "World Environment Day", date: '2026-06-05', category: 'Global Holidays' },
  { id: 'usr-06-08-a', title: "World Oceans Day", date: '2026-06-08', category: 'Global Holidays' },
  { id: 'usr-06-08-b', title: "Best Friends Day", date: '2026-06-08', category: 'Social Media Days' },
  { id: 'usr-06-10', title: "Dragon Boat Festival (2026)", date: '2026-06-10', category: 'Global Holidays' },
  { id: 'usr-06-12', title: "Dia dos Namorados (Brazilian Valentine's)", date: '2026-06-12', category: 'National Days', country: 'Brazil' },
  { id: 'usr-06-14', title: "World Blood Donor Day", date: '2026-06-14', category: 'Global Holidays' },
  { id: 'usr-06-16', title: "Father's Day (2026)", date: '2026-06-16', category: 'Global Holidays' },
  { id: 'usr-06-19', title: "Juneteenth", date: '2026-06-19', category: 'National Days', country: 'USA' },
  { id: 'usr-06-20', title: "World Refugee Day", date: '2026-06-20', category: 'Global Holidays' },
  { id: 'usr-06-21-a', title: "World Music Day", date: '2026-06-21', category: 'Global Holidays' },
  { id: 'usr-06-21-b', title: "International Day of Yoga", date: '2026-06-21', category: 'Global Holidays' },
  { id: 'usr-06-21-c', title: "Summer Solstice", date: '2026-06-21', category: 'Global Holidays' },
  { id: 'usr-06-24', title: "Midsummer Day", date: '2026-06-24', category: 'Global Holidays' },
  { id: 'usr-06-26', title: "Day Against Drug Abuse and Trafficking", date: '2026-06-26', category: 'Global Holidays' },
  { id: 'usr-06-30', title: "Social Media Day", date: '2026-06-30', category: 'Marketing Events' },

  // JUL
  { id: 'usr-07-04', title: "Independence Day (USA)", date: '2026-07-04', category: 'National Days', country: 'USA' },
  { id: 'usr-07-05', title: "International Kissing Day", date: '2026-07-05', category: 'Social Media Days' },
  { id: 'usr-07-07', title: "World Chocolate Day", date: '2026-07-07', category: 'Social Media Days' },
  { id: 'usr-07-11', title: "World Population Day", date: '2026-07-11', category: 'Global Holidays' },
  { id: 'usr-07-12', title: "National French Fries Day", date: '2026-07-12', category: 'Social Media Days' },
  { id: 'usr-07-15', title: "World Youth Skills Day", date: '2026-07-15', category: 'Global Holidays' },
  { id: 'usr-07-17', title: "World Emoji Day", date: '2026-07-17', category: 'Social Media Days' },
  { id: 'usr-07-25', title: "Driver's Day (Brazil)", date: '2026-07-25', category: 'National Days', country: 'Brazil' },
  { id: 'usr-07-28', title: "World Hepatitis Day", date: '2026-07-28', category: 'Global Holidays' },
  { id: 'usr-07-30', title: "International Friendship Day", date: '2026-07-30', category: 'Global Holidays' },

  // AUG
  { id: 'usr-08-01', title: "Back to School", date: '2026-08-01', category: 'Marketing Events' },
  { id: 'usr-08-04', title: "National Sister's Day (2026)", date: '2026-08-04', category: 'Social Media Days' },
  { id: 'usr-08-08', title: "International Cat Day", date: '2026-08-08', category: 'Social Media Days' },
  { id: 'usr-08-09', title: "National Book Lovers Day", date: '2026-08-09', category: 'Social Media Days' },
  { id: 'usr-08-10', title: "World Lion Day", date: '2026-08-10', category: 'Global Holidays' },
  { id: 'usr-08-11', title: "Sons and Daughters Day", date: '2026-08-11', category: 'Social Media Days' },
  { id: 'usr-08-12-a', title: "International Youth Day", date: '2026-08-12', category: 'Global Holidays' },
  { id: 'usr-08-12-b', title: "World Elephant Day", date: '2026-08-12', category: 'Global Holidays' },
  { id: 'usr-08-13', title: "International Left-Handers Day", date: '2026-08-13', category: 'Global Holidays' },
  { id: 'usr-08-14', title: "Independence Day (Pakistan)", date: '2026-08-14', category: 'National Days', country: 'Pakistan' },
  { id: 'usr-08-17', title: "Black Cat Appreciation Day", date: '2026-08-17', category: 'Social Media Days' },
  { id: 'usr-08-19-a', title: "World Photography Day", date: '2026-08-19', category: 'Global Holidays' },
  { id: 'usr-08-19-b', title: "National Potato Day", date: '2026-08-19', category: 'Social Media Days' },
  { id: 'usr-08-26', title: "International Dog Day", date: '2026-08-26', category: 'Social Media Days' },
  { id: 'usr-08-27', title: "Oil, Gas, and Fuel Industry Day", date: '2026-08-27', category: 'Global Holidays' },

  // SEP
  { id: 'usr-09-04', title: "Labour Day (2026)", date: '2026-09-04', category: 'Global Holidays' },
  { id: 'usr-09-05', title: "International Day of Charity", date: '2026-09-05', category: 'Global Holidays' },
  { id: 'usr-09-06', title: "National Read a Book Day", date: '2026-09-06', category: 'Social Media Days' },
  { id: 'usr-09-08', title: "International Literacy Day", date: '2026-09-08', category: 'Global Holidays' },
  { id: 'usr-09-15', title: "World Tourism Day", date: '2026-09-15', category: 'Global Holidays' },
  { id: 'usr-09-16', title: "World Ozone Day", date: '2026-09-16', category: 'Global Holidays' },
  { id: 'usr-09-21', title: "International Day of Peace", date: '2026-09-21', category: 'Global Holidays' },
  { id: 'usr-09-29-a', title: "Mid-Autumn Festival", date: '2026-09-29', category: 'Global Holidays' },
  { id: 'usr-09-29-b', title: "World Heart Day", date: '2026-09-29', category: 'Global Holidays' },

  // OCT
  { id: 'usr-10-01-a', title: "International Coffee Day", date: '2026-10-01', category: 'Social Media Days' },
  { id: 'usr-10-01-b', title: "Breast Cancer Awareness Month begins", date: '2026-10-01', category: 'Global Holidays' },
  { id: 'usr-10-04', title: "World Animal Day", date: '2026-10-04', category: 'Global Holidays' },
  { id: 'usr-10-05', title: "World Teachers' Day", date: '2026-10-05', category: 'Global Holidays' },
  { id: 'usr-10-06', title: "World Smile Day", date: '2026-10-06', category: 'Social Media Days' },
  { id: 'usr-10-09', title: "World Post Day", date: '2026-10-09', category: 'Global Holidays' },
  { id: 'usr-10-10', title: "World Mental Health Day", date: '2026-10-10', category: 'Global Holidays' },
  { id: 'usr-10-11', title: "International Day of the Girl Child", date: '2026-10-11', category: 'Global Holidays' },
  { id: 'usr-10-13', title: "Grandparents Day", date: '2026-10-13', category: 'Global Holidays' },
  { id: 'usr-10-15-a', title: "Global Handwashing Day", date: '2026-10-15', category: 'Global Holidays' },
  { id: 'usr-10-15-b', title: "International Day of Rural Women", date: '2026-10-15', category: 'Global Holidays' },
  { id: 'usr-10-15-c', title: "White Cane Safety Day", date: '2026-10-15', category: 'Global Holidays' },
  { id: 'usr-10-16-a', title: "World Food Day", date: '2026-10-16', category: 'Global Holidays' },
  { id: 'usr-10-16-b', title: "World Spine Day", date: '2026-10-16', category: 'Global Holidays' },
  { id: 'usr-10-19', title: "Sweetest Day", date: '2026-10-19', category: 'Social Media Days' },
  { id: 'usr-10-29', title: "National Cat Day", date: '2026-10-29', category: 'Social Media Days' },
  { id: 'usr-10-31', title: "Halloween", date: '2026-10-31', category: 'Global Holidays' },

  // NOV
  { id: 'usr-11-01', title: "Day of the Dead", date: '2026-11-01', category: 'Global Holidays' },
  { id: 'usr-11-02', title: "All Souls' Day", date: '2026-11-02', category: 'Global Holidays' },
  { id: 'usr-11-04', title: "Diwali (2026)", date: '2026-11-04', category: 'Religious Events' },
  { id: 'usr-11-06', title: "Day for Preventing the Exploitation of the Environment", date: '2026-11-06', category: 'Global Holidays' },
  { id: 'usr-11-08', title: "World Urbanism Day", date: '2026-11-08', category: 'Global Holidays' },
  { id: 'usr-11-09', title: "World Freedom Day", date: '2026-11-09', category: 'Global Holidays' },
  { id: 'usr-11-11', title: "Veterans Day/Armistice Day", date: '2026-11-11', category: 'National Days', country: 'USA' },
  { id: 'usr-11-13', title: "World Kindness Day", date: '2026-11-13', category: 'Global Holidays' },
  { id: 'usr-11-14', title: "World Diabetes Day", date: '2026-11-14', category: 'Global Holidays' },
  { id: 'usr-11-16', title: "International Day for Tolerance", date: '2026-11-16', category: 'Global Holidays' },
  { id: 'usr-11-19', title: "International Men's Day", date: '2026-11-19', category: 'Global Holidays' },
  { id: 'usr-11-20', title: "Universal Children's Day", date: '2026-11-20', category: 'Global Holidays' },
  { id: 'usr-11-21', title: "World Television Day", date: '2026-11-21', category: 'Global Holidays' },
  { id: 'usr-11-23', title: "Thanksgiving (2026)", date: '2026-11-23', category: 'Global Holidays', country: 'USA' },
  { id: 'usr-11-24', title: "Black Friday (2026)", date: '2026-11-24', category: 'Marketing Events' },
  { id: 'usr-11-25', title: "Day for Elimination of Violence Against Women", date: '2026-11-25', category: 'Global Holidays' },
  { id: 'usr-11-27', title: "Cyber Monday (2026)", date: '2026-11-27', category: 'Marketing Events' },
  { id: 'usr-11-28', title: "Thanksgiving (2026)", date: '2026-11-28', category: 'Global Holidays' },

  // DEC
  { id: 'usr-12-01', title: "World AIDS Day", date: '2026-12-01', category: 'Global Holidays' },
  { id: 'usr-12-05', title: "International Volunteer Day", date: '2026-12-05', category: 'Global Holidays' },
  { id: 'usr-12-07', title: "Candle Day", date: '2026-12-07', category: 'Social Media Days' },
  { id: 'usr-12-10', title: "Human Rights Day", date: '2026-12-10', category: 'Global Holidays' },
  { id: 'usr-12-11', title: "Green Monday", date: '2026-12-11', category: 'Marketing Events' },
  { id: 'usr-12-14', title: "Free Shipping Day", date: '2026-12-14', category: 'Marketing Events' },
  { id: 'usr-12-18', title: "International Migrants Day", date: '2026-12-18', category: 'Global Holidays' },
  { id: 'usr-12-21', title: "Yalda Night (Iran)", date: '2026-12-21', category: 'National Days', country: 'Iran' },
  { id: 'usr-12-25', title: "Christmas Day", date: '2026-12-25', category: 'Global Holidays' },
  { id: 'usr-12-26', title: "Kwanzaa begins", date: '2026-12-26', category: 'Global Holidays' },
  { id: 'usr-12-28', title: "Boxing Day", date: '2026-12-28', category: 'Global Holidays', country: 'UK/Commonwealth' },
  { id: 'usr-12-31', title: "New Year's Eve", date: '2026-12-31', category: 'Global Holidays' },
  { id: 'bd-4', title: "Victory Day (Bangladesh)", date: '2026-12-16', category: 'National Days', country: 'BD' } // Retained BD day
];

function kuwaiticalendar(date: Date) {
    let day = date.getDate();
    let month = date.getMonth();
    let year = date.getFullYear();
    let m = month + 1;
    let y = year;
    if (m < 3) { y -= 1; m += 12; }
    const a = Math.floor(y / 100);
    let b = 2 - a + Math.floor(a / 4);
    if (y < 1583) b = 0;
    if (y === 1582) {
        if (m > 10 || (m === 10 && day >= 15)) b = 2 - a + Math.floor(a / 4);
        else b = 0;
    }
    let jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524;
    jd = jd - 0; // standard adjust 0
    let l = jd - 1948440 + 10632;
    const n = Math.floor((l - 1) / 10631);
    l = l - 10631 * n + 354;
    const j = (Math.floor((10985 - l) / 5316)) * (Math.floor((50 * l) / 17719)) + (Math.floor(l / 5670)) * (Math.floor((43 * l) / 15238));
    l = l - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) - (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
    month = Math.floor((24 * l) / 709);
    day = l - Math.floor((709 * month) / 24);
    year = 30 * n + j - 30;
    return { day, month, year };
}

const getIslamicEvents = (year: number): CalendarEvent[] => {
    // Note: The user provided manual dates for Ramadan and Eid for 2026. 
    // We are keeping this dynamic loop to ensure robust coverage for future years 
    // or exact Hijri calculation mappings alongside the fixed user list.
    const events: CalendarEvent[] = [];
    
    // Scan all days of the year to find exact match for Hijri dates
    for (let m = 0; m < 12; m++) {
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, m, d);
            const hijri = kuwaiticalendar(dateObj);
            const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            
            if (hijri.month === 9 && hijri.day === 1) {
                events.push({ id: `ramadan-dyn-${year}-${m}`, title: "Ramadan Begins (Dynamic)", date: dateStr, category: 'Religious Events', country: 'Global', description: 'Month of fasting, prayer, reflection.' });
            }
            if (hijri.month === 10 && hijri.day === 1) {
                events.push({ id: `fitr-dyn-${year}-${m}`, title: "Eid al-Fitr (Dynamic)", date: dateStr, category: 'Religious Events', country: 'Global', description: 'Festival of Breaking the Fast.' });
            }
            if (hijri.month === 12 && hijri.day === 10) {
                events.push({ id: `adha-dyn-${year}-${m}`, title: "Eid al-Adha (Dynamic)", date: dateStr, category: 'Religious Events', country: 'Global', description: 'Feast of the Sacrifice.' });
            }
        }
    }
    
    return events;
};

export const getAllEvents = (year: number = 2026): CalendarEvent[] => {
    return [...baseEvents, ...getIslamicEvents(year)];
};
