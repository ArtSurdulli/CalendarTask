/**
 * @format
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './src/app/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useTheme } from './src/theme';

function App() {
  // Light content (white clock and icons) on dark surfaces, dark on light.
  const { scheme } = useTheme();

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
        <RootNavigator />
      </SafeAreaProvider>
    </Provider>
  );
}

export default App;
