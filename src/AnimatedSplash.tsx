import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Opening sequence: the location pin settles in, its checkmark draws on
// ("local job, done"), a short hold, then the whole screen fades to reveal the
// app. The green background matches the native splash so the handoff is seamless.
const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_LENGTH = 40;

const GREEN = '#1E7A46';
const CREAM = '#F6F5F0';
const AMBER = '#C25E00';

export default function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const pin = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(CHECK_LENGTH)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    const run = Animated.sequence([
      Animated.spring(pin, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(check, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.delay(520),
      Animated.timing(fade, {
        toValue: 0,
        duration: 360,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    run.start(({ finished }) => {
      if (finished) {
        onDone();
      }
    });
    return () => run.stop();
  }, [pin, check, fade, onDone]);

  const scale = pin.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });
  const translateY = pin.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  return (
    <Animated.View style={[styles.fill, { opacity: fade }]} pointerEvents="none">
      <Animated.View style={{ opacity: pin, transform: [{ scale }, { translateY }] }}>
        <Svg width={132} height={132} viewBox="0 0 120 120">
          <Path
            d="M60 96 C 47 74 34 64 34 48 A26 26 0 1 1 86 48 C 86 64 73 74 60 96 Z"
            fill={CREAM}
          />
          <AnimatedPath
            d="M49 48 l8 9 l17 -18"
            fill="none"
            stroke={AMBER}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={CHECK_LENGTH}
            strokeDashoffset={check}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    alignItems: 'center',
    backgroundColor: GREEN,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 100,
  },
});
