import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from './theme';

// Stars are drawn as vector paths rather than characters, so they render the
// same everywhere and never fall back to an emoji glyph.
const STAR = 'M12 2.6 l2.9 5.9 l6.5 .9 l-4.7 4.6 l1.1 6.5 l-5.8 -3.1 l-5.8 3.1 l1.1 -6.5 l-4.7 -4.6 l6.5 -.9 Z';

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={STAR}
        fill={filled ? colors.gold : 'none'}
        stroke={filled ? colors.gold : colors.line}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Read-only display of a score out of five.
export function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} filled={n <= Math.round(rating)} size={size} />
      ))}
    </View>
  );
}

// Tappable version used when leaving a review.
export function StarPicker({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          hitSlop={6}
          style={({ pressed }) => [styles.tap, pressed && styles.pressed]}
        >
          <Star filled={n <= value} size={34} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  tap: {
    padding: 2,
  },
  pressed: {
    opacity: 0.6,
  },
});
