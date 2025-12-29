# Map Animation Architecture Analysis

## 🔍 Critical Issues Identified

### 1. **Scroll Progress Calculation - Per-Step vs Cumulative**

**Current Implementation:**
- `scrollProgress` is calculated **per step** in the IntersectionObserver (lines 334-360 in `page.tsx`)
- Calculation is based on viewport position relative to card center, not actual scroll distance
- Formula: `distanceFromCenter / (availableDistance * 0.6)` - only uses 60% of viewport
- Progress resets to 0 when step changes

**Problem:**
- ❌ Progress is **not normalized** to actual route distance
- ❌ Short routes and long routes get the same scroll-to-distance ratio
- ❌ No cumulative tracking across steps
- ❌ Progress calculation is viewport-based, not scroll-based

**Why This Fails:**
- A 1km walk route and a 1000km flight route both map scroll 0→1 to route 0→100%
- Vehicle appears to move at different speeds for different route lengths
- No way to maintain consistent vehicle speed across different route types

**Conceptual Fix:**
```
1. Calculate cumulative route distance for all steps up to current step
2. Calculate distance along current route segment based on scroll
3. Normalize scroll progress to actual route distance:
   scrollProgress = (scrollDistance / routeSegmentDistance) * normalizedFactor
4. Use Turf's `along()` with distance-based interpolation, not index-based
```

---

### 2. **Vehicle Position Calculation - Index-Based Instead of Distance-Based**

**Current Implementation (TripMapbox.tsx lines 770-787):**
```typescript
const coordIndex = Math.floor(routeCoords.length * progress);
const targetIndex = Math.min(Math.max(0, coordIndex), routeCoords.length - 1);
return routeCoords[targetIndex];
```

**Problem:**
- ❌ Uses **array index** instead of **distance along route**
- ❌ `Math.floor()` causes discrete jumps, not smooth interpolation
- ❌ No use of Turf's `along()` function for proper geographic interpolation
- ❌ Route coordinates may be unevenly spaced (OSRM returns variable density)

**Why This Fails:**
- Route coordinates are not evenly distributed (more points in curves, fewer on straights)
- Index-based calculation means vehicle moves faster on straight segments, slower on curves
- Discrete `Math.floor()` causes visible jumps between coordinate points
- No consideration of actual geographic distance

**Conceptual Fix:**
```
1. Convert route coordinates to Turf LineString
2. Calculate total route distance using Turf's `length()` (in meters/kilometers)
3. Calculate target distance: targetDistance = totalDistance * scrollProgress
4. Use Turf's `along()` to get precise position at that distance:
   const point = along(lineString, targetDistance, { units: 'kilometers' })
5. This ensures smooth, distance-based interpolation
```

---

### 3. **Animation Loop - Conflicts with Map Transitions**

**Current Implementation (TripMapbox.tsx lines 804-860):**
- `requestAnimationFrame` loop runs continuously
- Calls `map.easeTo()` on **every frame** (line 848)
- `easeTo()` has 100ms duration, but called every ~16ms (60fps)
- Simultaneous `flyTo()` and `fitBounds()` calls when step changes (lines 876-905)

**Problem:**
- ❌ `easeTo()` called faster than its duration → overlapping animations
- ❌ `easeTo()` conflicts with `flyTo()` and `fitBounds()` when step changes
- ❌ Camera updates on every frame cause jitter and performance issues
- ❌ No debouncing or throttling of camera updates

**Why This Fails:**
- MapLibre GL JS queues animation requests, causing lag when too many are queued
- `easeTo()` with 100ms duration called every 16ms = 6+ concurrent animations
- Step transitions trigger `flyTo()` while animation loop is calling `easeTo()` → conflict
- Camera jumps between competing animation targets

**Conceptual Fix:**
```
1. Separate vehicle position updates from camera updates
2. Throttle camera updates: only call easeTo() every 100-200ms, not every frame
3. Cancel pending map animations before starting new ones
4. Use a state machine:
   - IDLE: No animation
   - STEP_TRANSITION: Use flyTo()/fitBounds() (block easeTo)
   - FOLLOWING: Use easeTo() (block flyTo)
5. Check if map is already animating before calling easeTo()
```

---

### 4. **Vehicle Speed Normalization - Missing**

**Current Implementation:**
- Fixed `easingFactor = 0.25` (line 829)
- No consideration of route length
- No consideration of mode of travel speed
- Animation duration is the same regardless of route distance

**Problem:**
- ❌ Vehicle moves at same speed for 1km walk and 1000km flight
- ❌ No speed normalization based on mode of travel
- ❌ Fixed easing factor doesn't account for route length differences
- ❌ Short routes appear to move too fast, long routes too slow

**Why This Fails:**
- A 100m walk route and 5000km flight route both animate in same time
- User expects flight to appear faster than walk
- No way to maintain consistent visual speed across different route types

**Conceptual Fix:**
```
1. Calculate route segment distance (using Turf)
2. Define base speeds per mode:
   - walk: 5 km/h
   - bike: 20 km/h
   - car: 80 km/h
   - train: 120 km/h
   - flight: 800 km/h
3. Calculate animation duration: duration = (distance / speed) * normalizationFactor
4. Adjust easing factor based on route length:
   easingFactor = baseEasing * (baseRouteLength / actualRouteLength)
5. Or use time-based interpolation instead of frame-based
```

---

### 5. **Scroll → Distance Mapping - No Normalization**

**Current Implementation:**
- Scroll progress (0-1) directly maps to route coordinate index (0 to routeCoords.length)
- No distance calculation
- No normalization between different route lengths

**Problem:**
- ❌ 10% scroll on 1km route = 100m movement
- ❌ 10% scroll on 1000km route = 100km movement
- ❌ Vehicle appears to move 1000x faster on long routes
- ❌ No consistent scroll-to-distance ratio

**Conceptual Fix:**
```
1. Calculate route distance: routeDistance = Turf.length(routeLineString)
2. Define target scroll-to-distance ratio (e.g., 1% scroll = 1km movement)
3. Normalize scroll progress:
   normalizedProgress = (scrollProgress * routeDistance) / targetDistancePerScroll
4. Clamp to route bounds: Math.min(1, normalizedProgress)
5. Use normalized progress for along() calculation
```

---

### 6. **Step Activation Thresholds - Inconsistent**

**Current Implementation (page.tsx lines 302-368):**
- IntersectionObserver with `rootMargin: '-40% 0px -40% 0px'`
- `threshold: [0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]`
- Requires `intersectionRatio > 0.4` to trigger (line 323)
- Progress only starts when `cardCenter > viewportCenter` (line 351)

**Problem:**
- ❌ Step activation depends on card size (bigger cards trigger earlier)
- ❌ Progress calculation uses viewport position, not scroll distance
- ❌ Different card heights cause different activation points
- ❌ Reverse scrolling not handled symmetrically

**Conceptual Fix:**
```
1. Use scroll position relative to step card position, not viewport intersection
2. Calculate progress based on card's scroll position:
   cardTop = card.getBoundingClientRect().top + window.scrollY
   scrollY = window.scrollY
   progress = (scrollY - cardTop) / cardHeight
3. Normalize to 0-1: Math.max(0, Math.min(1, progress))
4. Handle reverse scrolling: if scrollY < cardTop, progress = 0
5. Use consistent thresholds regardless of card size
```

---

### 7. **Turf along() Usage - Not Implemented**

**Current Implementation:**
- No use of Turf's `along()` function
- No use of Turf's `length()` for distance calculation
- No conversion to Turf LineString format

**Problem:**
- ❌ Manual coordinate array indexing instead of distance-based interpolation
- ❌ No accurate distance calculations
- ❌ No proper geographic interpolation along route

**Conceptual Fix:**
```
1. Convert route coordinates to Turf LineString:
   const lineString = turf.lineString(routeCoords)
2. Calculate total distance:
   const totalDistance = turf.length(lineString, { units: 'kilometers' })
3. Calculate target distance along route:
   const targetDistance = totalDistance * scrollProgress
4. Get precise position:
   const point = turf.along(lineString, targetDistance, { units: 'kilometers' })
5. Use point.coordinates for vehicle position
```

---

### 8. **Reverse Scrolling - Not Handled**

**Current Implementation:**
- Progress calculation only works when scrolling down (line 351: `if (cardCenter > viewportCenter)`)
- No handling for scrolling back up
- Vehicle position doesn't reverse smoothly

**Problem:**
- ❌ Scrolling up doesn't reverse vehicle movement
- ❌ Progress resets to 0 abruptly when scrolling back
- ❌ No symmetric behavior for forward/backward scrolling

**Conceptual Fix:**
```
1. Track scroll direction (compare current scrollY with previous scrollY)
2. Calculate progress based on scroll position, not viewport intersection
3. Allow negative progress when scrolling back (clamp to 0)
4. Smoothly reverse vehicle movement when scrolling up
5. Maintain vehicle position state when scrolling between steps
```

---

### 9. **Step Transitions - Map Re-centering Conflicts**

**Current Implementation (TripMapbox.tsx lines 865-917):**
- When step changes, `flyTo()` or `fitBounds()` is called (lines 876, 900)
- Animation loop continues calling `easeTo()` (line 848)
- No coordination between step transition and animation loop

**Problem:**
- ❌ `flyTo()` and `easeTo()` conflict when step changes
- ❌ Camera jumps between competing animation targets
- ❌ Vehicle position may jump when route changes
- ❌ No smooth transition between route segments

**Conceptual Fix:**
```
1. Use animation state machine:
   - When step changes: set state to STEP_TRANSITION
   - Cancel all pending easeTo() calls
   - Complete flyTo()/fitBounds() first
   - Then transition to FOLLOWING state
2. Smooth vehicle transition:
   - When route changes, interpolate vehicle from old route end to new route start
   - Or snap vehicle to new route start position
   - Reset animation loop after step transition completes
3. Check animation state before calling easeTo():
   if (animationState === 'FOLLOWING') { map.easeTo(...) }
```

---

### 10. **Cumulative Distance Tracking - Missing**

**Current Implementation:**
- Each route segment is treated independently
- No cumulative distance calculation
- No tracking of total distance traveled

**Problem:**
- ❌ Can't calculate total trip distance
- ❌ Can't normalize scroll across entire trip
- ❌ Each step's progress is isolated

**Conceptual Fix:**
```
1. Pre-calculate cumulative distances:
   cumulativeDistances[0] = 0
   cumulativeDistances[i] = cumulativeDistances[i-1] + routeSegmentDistance[i-1]
2. Calculate total trip distance: totalDistance = cumulativeDistances[last]
3. Use cumulative distance for global progress calculation
4. Normalize scroll progress to total trip distance
```

---

## 📊 Summary of Required Changes

### Math Corrections:
1. **Replace index-based with distance-based interpolation** using Turf's `along()`
2. **Normalize scroll progress to route distance** instead of viewport position
3. **Calculate cumulative distances** across all route segments
4. **Use actual geographic distance** for all calculations

### State Flow Corrections:
1. **Separate vehicle animation from camera animation**
2. **Implement animation state machine** (IDLE → STEP_TRANSITION → FOLLOWING)
3. **Cancel pending animations** before starting new ones
4. **Track scroll direction** for reverse scrolling support

### Timing/Interpolation Strategy:
1. **Throttle camera updates** (every 100-200ms, not every frame)
2. **Normalize vehicle speed** based on route length and mode of travel
3. **Use time-based interpolation** instead of fixed easing factor
4. **Smooth step transitions** with proper state management

### Scroll Normalization:
1. **Calculate progress based on scroll position**, not viewport intersection
2. **Normalize to route distance** instead of viewport percentage
3. **Handle reverse scrolling** symmetrically
4. **Use consistent thresholds** regardless of card size

---

## 🎯 Priority Fixes (In Order)

1. **HIGH**: Replace index-based with Turf `along()` for distance-based interpolation
2. **HIGH**: Normalize scroll progress to route distance
3. **MEDIUM**: Implement animation state machine to prevent conflicts
4. **MEDIUM**: Throttle camera updates (don't call easeTo() every frame)
5. **LOW**: Add vehicle speed normalization based on mode of travel
6. **LOW**: Implement cumulative distance tracking

---

## 🔧 Implementation Strategy

### Phase 1: Core Interpolation Fix
- Install `@turf/turf` if not already installed
- Replace `calculateTargetPosition()` to use Turf's `along()`
- Calculate route distance using Turf's `length()`

### Phase 2: Scroll Normalization
- Change scroll progress calculation to use scroll position, not viewport
- Normalize scroll progress to route distance
- Handle reverse scrolling

### Phase 3: Animation Coordination
- Implement animation state machine
- Separate vehicle updates from camera updates
- Throttle camera updates
- Cancel conflicting animations

### Phase 4: Speed Normalization (Optional)
- Add speed constants per mode of travel
- Normalize animation speed based on route length
- Adjust easing factor dynamically

