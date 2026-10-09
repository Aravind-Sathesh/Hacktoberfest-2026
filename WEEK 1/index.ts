import { registerRootComponent } from 'expo';
import App from './App';
// Registers the GPS task before anything else so Android can wake it with the app closed
import './src/tracking';

registerRootComponent(App);
