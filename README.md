# Traysikel KO - Tricycle Booking App

A modern, professional mobile UI for Traysikel KO - a JoyRide-style tricycle booking application where passengers can find nearby tricycles, book rides, and drivers can register/login and receive bookings.

## 🎨 Design System

- **Primary Color**: Blue (#2F80ED)
- **Background**: White (#FFFFFF)
- **Text**: Dark (#1D1D1D)
- **Style**: Modern, clean, minimal with rounded corners (12-20px) and soft shadows
- **Vibe**: Professional Filipino transportation app

## 📱 Features

### For Passengers
- Find nearby tricycles on live map
- Book rides with pickup and dropoff selection
- Fare estimation
- Trip history
- Profile management
- SOS emergency button

### For Drivers
- Online/Offline status toggle
- Receive and accept booking requests
- View passenger details and routes
- Trip history with earnings
- Profile with verification status
- SOS emergency button

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Expo CLI

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on your preferred platform:
```bash
npm run ios     # iOS
npm run android # Android
npm run web     # Web
```

## 📂 Project Structure

```
src/
├── components/     # Reusable UI components
├── screens/       # All app screens
├── navigation/    # Navigation setup
├── theme/         # Design system (colors, typography, spacing)
└── utils/         # Utility functions (validation, etc.)
```

## 🎯 Screen Flows

1. **Splash Screen** - App branding and tagline
2. **User Selection** - Choose Passenger or Driver
3. **Create Account** - Separate flows for Passenger and Driver
4. **Login** - Email/password authentication
5. **Passenger Home** - Map, booking, nearby tricycles
6. **Driver Home** - Status toggle, incoming bookings
7. **Trip History** - Past rides and earnings
8. **Profile** - User information and settings
9. **SOS** - Emergency assistance

## 🛠 Technologies

- React Native
- Expo
- TypeScript
- React Navigation
- React Native Maps
- Expo Image Picker
- React Native Gesture Handler
- React Native Reanimated

## 📝 Notes

- Map integration uses react-native-maps (configure Google Maps API key for production)
- Image picker requires camera and media library permissions
- Location services need to be configured for GPS features
- All forms include validation with Philippine phone number and email validation
- UI is fully responsive and follows modern mobile design patterns
- All screens are implemented with proper navigation flow
- Reusable components are available throughout the app
- Forms include proper error handling and validation messages

## 🎯 Implemented Features

### Authentication & Onboarding
- ✅ Splash screen with animated logo and tagline
- ✅ User type selection (Passenger/Driver)
- ✅ Separate account creation flows
- ✅ Login screens with email/password
- ✅ Form validation for all inputs

### Passenger Features
- ✅ Live map with tricycle markers
- ✅ Find nearby tricycles functionality
- ✅ Book a ride with pickup/dropoff selection
- ✅ Fare estimation
- ✅ Trip history with driver details
- ✅ Profile with edit functionality
- ✅ SOS emergency button (floating)

### Driver Features
- ✅ Online/Offline status toggle
- ✅ Incoming booking notifications
- ✅ Passenger details and route information
- ✅ Accept/Decline booking requests
- ✅ Trip history with earnings summary
- ✅ Profile with verification status
- ✅ License and vehicle information display
- ✅ SOS emergency button

### Design System
- ✅ Consistent color palette (Blue #2F80ED primary)
- ✅ Typography system with proper hierarchy
- ✅ Spacing and layout consistency
- ✅ Rounded corners (12-20px)
- ✅ Soft shadows for depth
- ✅ Professional Filipino transportation vibe

## 🎨 Components

Reusable components include:
- Button (multiple variants)
- Input (with validation)
- Card
- BottomSheet
- BottomNavigation
- SOSButton
- StatusToggle
- ImagePicker

## 📄 License

This project is created for Traysikel KO.
