# 🚲 TRAYSIKEL KO - System Flow Alignment Document

This document compares the described system flow with the current implementation and identifies areas for alignment.

---

## ✅ **IMPLEMENTED FEATURES**

### 🧍 **PASSENGER ACCOUNT FLOW**

#### ✅ Step 1: Open App & Login
- **Status**: ✅ Fully Implemented
- **Location**: `LoginScreen.tsx`
- **Details**: Email/password login, account type detection (passenger/driver)

#### ✅ Step 2: Display Live Map
- **Status**: ✅ Fully Implemented
- **Location**: `PassengerHomeScreen.tsx` (map not always visible, but location tracking works)
- **Note**: Map is shown in `EnterDropoffScreen.tsx` with current location

#### ✅ Step 3: Select Pickup & Drop-off Locations
- **Status**: ✅ Fully Implemented
- **Location**: `EnterDropoffScreen.tsx`
- **Details**: 
  - Map-based selection
  - Search functionality
  - Favorite locations support
  - Current location auto-detection

#### ✅ Step 4: Show Nearby Tricycles
- **Status**: ✅ Fully Implemented
- **Location**: `PassengerHomeScreen.tsx` (lines 217-293)
- **Details**: 
  - Real-time driver locations
  - Distance calculation
  - ETA estimation
  - Safety badges
  - Driver ratings

#### ✅ Step 5: Select Driver / Auto Assign
- **Status**: ✅ Partially Implemented
- **Location**: `PassengerHomeScreen.tsx`, `EnterDropoffScreen.tsx`
- **Details**: 
  - ✅ Passengers can select a preferred driver
  - ⚠️ No explicit "Auto Assign" button (but system automatically shows bookings to all drivers)

#### ✅ Step 6: Fare Calculation
- **Status**: ✅ Fully Implemented
- **Location**: `tripStorage.ts` (calculateFareEstimate), `barangayRates.ts`
- **Details**: 
  - LGU fare matrix integration
  - Night trip surcharge
  - Senior Citizen / PWD discount (20%)
  - Pasabay/Padala surcharge (20%)
  - Minimum fare enforcement

#### ✅ Step 7: Confirm Booking
- **Status**: ✅ Fully Implemented
- **Location**: `ConfirmBookingScreen.tsx`
- **Details**: 
  - Trip summary
  - Fare breakdown
  - Discount display
  - Ride type badge

#### ✅ Step 8: Booking Status & Forwarding
- **Status**: ✅ Implemented (with minor terminology difference)
- **Location**: `tripStorage.ts` (createBooking)
- **Details**: 
  - Booking status set to `'searching'` (described flow says "Pending")
  - Bookings automatically visible to all nearby online drivers
  - Status updates when driver accepts

---

### 🛺 **DRIVER ACCOUNT FLOW**

#### ✅ Step 1: Open App & Login
- **Status**: ✅ Fully Implemented
- **Location**: `LoginScreen.tsx`
- **Details**: Driver account verification check

#### ✅ Step 2: Set Status to Online
- **Status**: ✅ Fully Implemented
- **Location**: `DriverHomeScreen.tsx` (StatusToggle component)
- **Details**: 
  - Status options: Offline, Available, On Ride
  - Location tracking when online
  - Verification requirement check

#### ✅ Step 3: Receive Booking Requests
- **Status**: ✅ Fully Implemented
- **Location**: `DriverHomeScreen.tsx` (loadAllBookings function)
- **Details**: 
  - Real-time booking updates (every 3 seconds)
  - Shows all available bookings from all passengers
  - Distance and ETA calculation
  - Booking details display

#### ✅ Step 4: Review Trip Details
- **Status**: ✅ Fully Implemented
- **Location**: `DriverHomeScreen.tsx` (booking cards)
- **Details**: 
  - Passenger name and phone
  - Pickup and dropoff locations
  - Fare estimate
  - Distance to pickup
  - ETA to pickup

#### ✅ Step 5: Accept or Decline
- **Status**: ⚠️ Partially Implemented
- **Location**: `DriverHomeScreen.tsx` (handleAcceptBooking)
- **Details**: 
  - ✅ Accept button implemented
  - ⚠️ No explicit "Decline" button (drivers can simply ignore/scroll past)
  - ✅ System automatically forwards bookings to other drivers (bookings remain visible until accepted)
  - ⚠️ No explicit decline action that logs the decline

#### ✅ Step 6: If Driver Accepts
- **Status**: ✅ Fully Implemented
- **Location**: `DriverHomeScreen.tsx`, `AcceptedRideScreen.tsx`
- **Details**: 
  - Driver assigned to booking
  - Status changes to 'driver_accepted'
  - Passenger notified
  - Navigation to AcceptedRide screen
  - Live tracking begins

#### ✅ Step 7: If Driver Declines
- **Status**: ✅ Implemented (Implicitly)
- **Details**: 
  - Bookings remain visible to other drivers
  - System automatically shows booking to next available driver
  - No explicit decline tracking (which may be fine)

---

## ⚠️ **AREAS NEEDING ALIGNMENT**

### 1. **Ride Mode Selection UI**

**Described Flow:**
> "Passenger selects preferred ride mode: Regular Ride Mode | Senior Citizen / PWD Mode | Pasabay Padala / Errand Mode"

**Current Implementation:**
- ✅ Normal Ride vs Pasabay/Padala toggle exists
- ⚠️ Senior Citizen/PWD discount is auto-applied based on profile settings
- ❌ No explicit "Senior Citizen / PWD Mode" selection in booking flow

**Recommendation:**
Add explicit ride mode selection with three options:
- Regular Ride Mode
- Senior Citizen / PWD Mode (with discount indicator)
- Pasabay Padala / Errand Mode

**Files to Modify:**
- `EnterDropoffScreen.tsx` - Add ride mode selector
- `ConfirmBookingScreen.tsx` - Display selected mode clearly

---

### 2. **Booking Status Terminology**

**Described Flow:**
> "Booking status is set to Pending and forwarded to nearby drivers"

**Current Implementation:**
- Booking status is set to `'searching'` instead of `'pending'`

**Recommendation:**
Either:
- Option A: Change status to `'pending'` to match flow description
- Option B: Keep `'searching'` (more descriptive) but document that it's equivalent to "Pending"

**Files to Modify (if Option A):**
- `tripStorage.ts` - Change status values
- All screens that check booking status

---

### 3. **Auto-Assign Option**

**Described Flow:**
> "Passenger selects a preferred driver or allows the system to automatically assign the nearest available tricycle"

**Current Implementation:**
- Passengers can select a driver
- No explicit "Auto Assign" button/toggle
- System already auto-assigns by showing booking to all drivers

**Recommendation:**
Add an "Auto Assign" toggle/option:
- When enabled: System automatically assigns nearest available driver
- When disabled: Passenger must manually select a driver
- Default: Auto Assign enabled

**Files to Modify:**
- `EnterDropoffScreen.tsx` - Add auto-assign toggle
- `ConfirmBookingScreen.tsx` - Show auto-assign status
- `tripStorage.ts` - Handle auto-assignment logic

---

### 4. **Explicit Driver Decline Action**

**Described Flow:**
> "Driver chooses to Accept or Decline the booking request. If Driver Declines: The system automatically forwards the booking request to another nearby available driver."

**Current Implementation:**
- ✅ Accept button exists
- ⚠️ No explicit Decline button
- ✅ System automatically forwards (bookings remain visible)
- ❌ No decline tracking/logging

**Recommendation:**
Add an explicit "Decline" button that:
- Marks booking as declined by specific driver (for analytics)
- Automatically removes booking from that driver's view
- Keeps booking visible to other drivers
- Optionally tracks decline reasons

**Files to Modify:**
- `DriverHomeScreen.tsx` - Add Decline button to booking cards
- `tripStorage.ts` - Add declineBooking function
- Consider adding decline tracking in Trip interface

---

### 5. **Booking Notification System**

**Described Flow:**
> "Driver receives a booking notification"

**Current Implementation:**
- Bookings appear in a list on DriverHomeScreen
- No push notifications or sound alerts
- No "new booking" indicator

**Recommendation:**
Add notification features:
- Visual indicator for new bookings (badge/count)
- Optional sound notification when new booking arrives
- Highlight newly received bookings

**Files to Modify:**
- `DriverHomeScreen.tsx` - Add notification badges
- Consider adding notification service

---

## 📋 **SUMMARY OF RECOMMENDATIONS**

### High Priority
1. ✅ **Add explicit "Senior Citizen / PWD Mode" selection** in ride mode selector
2. ✅ **Add explicit "Decline" button** for drivers with tracking

### Medium Priority
3. ⚠️ **Add "Auto Assign" toggle** for passengers
4. ⚠️ **Add booking notifications** (visual indicators)

### Low Priority
5. ⚠️ **Align terminology** (Pending vs Searching) - Optional, current works fine

---

## 🎯 **IMPLEMENTATION PRIORITY**

### Phase 1: Critical Alignment
1. Ride mode selection (Regular / Senior-PWD / Pasabay-Padala)
2. Driver decline functionality with tracking

### Phase 2: Enhanced UX
3. Auto-assign toggle
4. Booking notifications

### Phase 3: Polish
5. Terminology alignment (optional)

---

## 📝 **NOTES**

- The current implementation is functionally complete and works well
- Most "gaps" are UI/UX improvements rather than missing functionality
- The auto-forward mechanism already works (bookings are visible to all drivers)
- Senior/PWD discounts are working correctly (auto-applied from profile)
- The system is production-ready, but these enhancements would improve alignment with the described flow

---

**Document Created**: $(date)
**Last Updated**: $(date)
