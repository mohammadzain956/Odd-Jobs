export const OTHER_AREA = 'Other area';

// Major cities carry curated area lists; every other city falls back to the
// "Other area" type-in. Ordered roughly by size so the biggest come first.
const CITIES: Array<{ name: string; areas: string[] }> = [
  {
    name: 'Karachi',
    areas: [
      'DHA', 'Clifton', 'Gulshan-e-Iqbal', 'Gulistan-e-Johar', 'North Nazimabad', 'PECHS', 'Bahadurabad',
      'Korangi', 'Malir', 'Saddar', 'Nazimabad', 'Federal B Area', 'Landhi', 'Orangi Town',
    ],
  },
  {
    name: 'Lahore',
    areas: [
      'DHA', 'Gulberg', 'Johar Town', 'Model Town', 'Bahria Town', 'Wapda Town', 'Allama Iqbal Town',
      'Cantt', 'Askari', 'Garden Town', 'Faisal Town', 'Samanabad', 'Shalimar', 'Walled City', 'Valencia',
    ],
  },
  {
    name: 'Islamabad',
    areas: [
      'F sectors', 'G sectors', 'I sectors', 'E sectors', 'Blue Area', 'DHA', 'Bahria Enclave',
      'Bani Gala', 'PWD', 'Ghauri Town',
    ],
  },
  {
    name: 'Rawalpindi',
    areas: ['Saddar', 'Bahria Town', 'DHA', 'Satellite Town', 'Chaklala', 'Westridge', 'Peshawar Road', 'Adiala Road'],
  },
  {
    name: 'Faisalabad',
    areas: ['D Ground', 'Peoples Colony', 'Madina Town', 'Jaranwala Road', 'Samanabad', 'Susan Road', 'Millat Town'],
  },
  {
    name: 'Gujranwala',
    areas: ['Satellite Town', 'Peoples Colony', 'Wapda Town', 'Model Town', 'Civil Lines'],
  },
  {
    name: 'Multan',
    areas: ['Cantt', 'Gulgasht Colony', 'Shah Rukn-e-Alam', 'Bosan Road', 'Model Town', 'New Multan'],
  },
  {
    name: 'Peshawar',
    areas: ['Hayatabad', 'University Town', 'Saddar', 'Gulbahar', 'Warsak Road', 'Ring Road'],
  },
  {
    name: 'Sialkot',
    areas: ['Cantt', 'Model Town', 'Shahab Pura', 'Daska Road', 'Wazirabad Road'],
  },
  {
    name: 'Quetta',
    areas: ['Cantt', 'Jinnah Town', 'Satellite Town', 'Samungli Road', 'Airport Road'],
  },
  {
    name: 'Hyderabad',
    areas: ['Latifabad', 'Qasimabad', 'Saddar', 'Auto Bhan Road', 'City Center'],
  },
  { name: 'Bahawalpur', areas: [] },
  { name: 'Sargodha', areas: [] },
  { name: 'Sahiwal', areas: [] },
  { name: 'Sukkur', areas: [] },
  { name: 'Larkana', areas: [] },
  { name: 'Sheikhupura', areas: [] },
  { name: 'Jhang', areas: [] },
  { name: 'Rahim Yar Khan', areas: [] },
  { name: 'Gujrat', areas: [] },
  { name: 'Kasur', areas: [] },
  { name: 'Okara', areas: [] },
  { name: 'Wah Cantt', areas: [] },
  { name: 'Dera Ghazi Khan', areas: [] },
  { name: 'Mardan', areas: [] },
  { name: 'Abbottabad', areas: [] },
  { name: 'Mingora (Swat)', areas: [] },
  { name: 'Kohat', areas: [] },
  { name: 'Bannu', areas: [] },
  { name: 'Nawabshah', areas: [] },
  { name: 'Mirpur Khas', areas: [] },
  { name: 'Chiniot', areas: [] },
  { name: 'Hafizabad', areas: [] },
  { name: 'Sadiqabad', areas: [] },
  { name: 'Burewala', areas: [] },
  { name: 'Muzaffargarh', areas: [] },
  { name: 'Khanewal', areas: [] },
  { name: 'Jacobabad', areas: [] },
  { name: 'Shikarpur', areas: [] },
  { name: 'Attock', areas: [] },
  { name: 'Jhelum', areas: [] },
  { name: 'Chakwal', areas: [] },
  { name: 'Mandi Bahauddin', areas: [] },
  { name: 'Toba Tek Singh', areas: [] },
  { name: 'Vehari', areas: [] },
  { name: 'Bahawalnagar', areas: [] },
  { name: 'Muridke', areas: [] },
  { name: 'Daska', areas: [] },
  { name: 'Gojra', areas: [] },
  { name: 'Turbat', areas: [] },
  { name: 'Gwadar', areas: [] },
  { name: 'Khuzdar', areas: [] },
  { name: 'Muzaffarabad (AJK)', areas: [] },
  { name: 'Mirpur (AJK)', areas: [] },
  { name: 'Gilgit', areas: [] },
  { name: 'Skardu', areas: [] },
];

export const CITY_NAMES = CITIES.map((city) => city.name);

export function areasFor(city: string): string[] {
  const found = CITIES.find((entry) => entry.name === city);
  return [...(found?.areas ?? []), OTHER_AREA];
}

// Curated browse-filter areas for a city (no "Other area" - the filter's
// "All areas" option already covers posts with typed-in areas).
export function filterAreasFor(city: string): string[] {
  const found = CITIES.find((entry) => entry.name === city);
  return found?.areas ?? [];
}
