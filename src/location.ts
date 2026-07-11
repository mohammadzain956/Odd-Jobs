import * as Location from 'expo-location';
import { CITY_NAMES } from './locations';

// Detects which supported city the user is in, using the phone's GPS and the
// platform's built-in reverse geocoder (free, no API key). Returns null when
// permission is denied, detection fails, or the city is not in our list.
export async function detectCity(): Promise<string | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const places = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    const raw = (places[0]?.city ?? places[0]?.subregion ?? places[0]?.region ?? '').toLowerCase();
    if (!raw) {
      return null;
    }
    return (
      CITY_NAMES.find(
        (city) => raw.includes(city.toLowerCase()) || city.toLowerCase().includes(raw),
      ) ?? null
    );
  } catch {
    return null;
  }
}
