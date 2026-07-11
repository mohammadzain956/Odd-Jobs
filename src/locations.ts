export const OTHER_AREA = 'Other area';

const CITIES: Array<{ name: string; areas: string[] }> = [
  {
    name: 'Lahore',
    areas: [
      'DHA', 'Gulberg', 'Johar Town', 'Model Town', 'Bahria Town', 'Wapda Town', 'Allama Iqbal Town',
      'Cantt', 'Askari', 'Garden Town', 'Faisal Town', 'Samanabad', 'Shalimar', 'Walled City', 'Valencia',
    ],
  },
  {
    name: 'Karachi',
    areas: [
      'DHA', 'Clifton', 'Gulshan-e-Iqbal', 'Gulistan-e-Johar', 'North Nazimabad', 'PECHS', 'Bahadurabad',
      'Korangi', 'Malir', 'Saddar', 'Nazimabad', 'Federal B Area', 'Landhi', 'Orangi Town',
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
];

export const CITY_NAMES = CITIES.map((city) => city.name);

export function areasFor(city: string): string[] {
  const found = CITIES.find((entry) => entry.name === city);
  return [...(found?.areas ?? []), OTHER_AREA];
}
