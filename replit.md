# Overview

This is a German classroom seating plan management application called "Sitzplan - Klassenverwaltung" (Seating Plan - Class Management). It's a web-based tool that allows teachers to manage multiple classes, arrange students in a customizable grid layout, track student grades, and maintain various classroom metrics. The application features drag-and-drop functionality for seat arrangements, grade tracking with visual indicators, and persistent data storage using browser localStorage.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Pure Vanilla JavaScript**: Single-page application built without frameworks, using ES6 classes and modern JavaScript features
- **Object-Oriented Design**: Main `SeatingPlan` class encapsulates all application logic and state management
- **Component-Based UI**: Modular approach with separate methods for creating different UI components (seats, student cards, modals)
- **Event-Driven Architecture**: Comprehensive event binding system handling user interactions, drag-and-drop operations, and UI updates

## Data Management
- **In-Memory State**: Uses JavaScript Maps and Arrays for efficient data structure management
- **Local Storage Persistence**: All application data (classes, students, grades, seating arrangements) persisted to browser localStorage
- **Class-Based Organization**: Multi-class support with isolated data per classroom

## User Interface Design
- **CSS Grid Layout**: Customizable classroom grid system (configurable rows/columns)
- **Drag-and-Drop Interface**: Native HTML5 drag-and-drop API for intuitive seat arrangement
- **Responsive Design**: Mobile-friendly interface with touch support and responsive controls
- **Modern CSS**: Uses CSS Grid, Flexbox, backdrop filters, and modern styling techniques

## Key Features Architecture
- **Grade Management System**: Visual grade tracking with color-coded indicators and configurable starting grades
- **Counter System**: Student-specific counters with long-press interactions and visual feedback
- **Multi-Modal Interface**: Overlay modals for student editing, class management, and grade tables
- **Sidebar Integration**: Collapsible student list with real-time synchronization

## Interaction Patterns
- **Touch-Optimized**: Long-press detection for mobile devices (500ms threshold)
- **Visual Feedback**: Immediate visual responses for all user interactions
- **State Persistence**: Automatic saving of all changes to localStorage
- **Progressive Enhancement**: Core functionality works without JavaScript frameworks

# External Dependencies

## Browser APIs
- **Local Storage API**: Primary persistence mechanism for all application data
- **HTML5 Drag and Drop API**: Core functionality for seat arrangement interface
- **Touch Events API**: Mobile device support for long-press interactions

## No External Libraries
- **Framework-Free**: No JavaScript frameworks or libraries required
- **Self-Contained**: All functionality implemented using native web technologies
- **CSS-Only Styling**: No external CSS frameworks or icon libraries used (uses Unicode emojis for icons)

## Browser Compatibility Requirements
- **Modern Browser Features**: Requires support for ES6 classes, CSS Grid, and modern JavaScript APIs
- **Local Storage Support**: Essential for data persistence functionality
- **Drag and Drop Support**: Required for primary seating arrangement feature