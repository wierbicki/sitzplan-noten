class SeatingPlan {
    constructor() {
        this.version = "2.1.0"; // Application version - update this when making changes
        this.classes = new Map(); // Store all classes and their data
        this.currentClassId = null;
        this.students = [];
        this.desks = []; // Changed from seats to desks
        this.draggedElement = null;
        this.gridRows = 5; // Keep for legacy compatibility
        this.gridColumns = 6; // Keep for legacy compatibility
        this.useFlexibleLayout = true; // New: enable flexible desk positioning
        this.currentEditingStudent = null;
        this.studentCounters = new Map(); // Store counters for each student
        this.longPressTimer = null;
        this.isLongPress = false;
        this.longPressDelay = 500; // 500ms for long press
        this.counterStartTime = null; // Track when counter press started
        this.showGrades = false; // Toggle for grade display
        this.startingGrade = 4.0; // Default starting grade
        this.gradeTable = new Map(); // Store grade table data: studentId -> Map(dateColumn -> grade)
        this.absenceTable = new Map(); // Store absence data: studentId -> Map(dateColumn -> boolean)
        this.latenessTable = new Map(); // Store lateness data: studentId -> Map(dateColumn -> number) (0=none, 5=5min, 10=10min, 15=over10min)
        this.hiddenGrades = new Map(); // Store temporarily hidden grades due to absence: studentId -> Map(dateColumn -> grade)
        this.periods = new Map(); // Store grading periods: periodId -> {name, columns, active}
        this.activePeriodId = null; // ID of currently active period
        this.sortColumn = 'lastName'; // Current sort column
        this.sortDirection = 'asc'; // 'asc' or 'desc'
        this.isDragging = false; // Track if drag operation is active
        this.dragStartPosition = null; // Track initial position for drag detection
        this.isEditingClass = false; // Track if we're editing a class
        this.editingClassId = null; // Track which class is being edited
        this.nextDeskId = 0; // Unique desk ID counter
        this.deskRemovalMode = false;
        
        // Cache bound functions to fix event listener memory leak
        this.boundHandleDeskMouseMove = this.handleDeskMouseMove.bind(this);
        this.boundHandleDeskMouseUp = this.handleDeskMouseUp.bind(this);
        
        this.init();
    }

    init() {
        this.createClassroom();
        this.bindEvents();
        this.loadClasses();
        this.updateClassSelect();
        this.updateVersionDisplay();
    }

    updateVersionDisplay() {
        const versionElement = document.getElementById('versionInfo');
        if (versionElement) {
            versionElement.textContent = `Version ${this.version}`;
        }
    }

    createClassroom() {
        const classroom = document.getElementById('classroomGrid');
        classroom.innerHTML = '';
        
        // Don't reset desks array - this would wipe out loaded data
        // Only initialize default desks if array is empty
        
        // Change from grid to flexible positioning
        classroom.style.position = 'relative';
        classroom.style.gridTemplateColumns = 'none';
        classroom.style.gridTemplateRows = 'none';
        classroom.style.display = 'block';

        // Create default desks if none exist
        if (this.desks.length === 0) {
            this.createDefaultDesks();
        }

        this.renderDesks();
    }

    createDefaultDesks() {
        // No default desks - start with empty classroom
        // Users can add desks manually using the "Einzeltisch" or "Doppeltisch" buttons
    }

    renderDesks() {
        const classroom = document.getElementById('classroomGrid');
        classroom.innerHTML = ''; // Clear existing desks before re-rendering
        
        this.desks.forEach(desk => {
            const deskElement = this.createDeskElement(desk);
            classroom.appendChild(deskElement);
            desk.element = deskElement;
        });
    }

    createDeskElement(desk) {
        const deskEl = document.createElement('div');
        deskEl.className = `desk desk-${desk.type}`;
        deskEl.dataset.deskId = desk.id;
        deskEl.style.position = 'absolute';
        deskEl.style.left = desk.x + 'px';
        deskEl.style.top = desk.y + 'px';

        // Set different sizes for single vs double desks
        if (desk.type === 'single') {
            deskEl.style.width = '100px';
            deskEl.style.height = '80px';
        } else {
            deskEl.style.width = '225px';
            deskEl.style.height = '80px';
        }

        // Add drag and drop events
        deskEl.addEventListener('dragover', this.handleDragOver.bind(this));
        deskEl.addEventListener('drop', this.handleDrop.bind(this));
        deskEl.addEventListener('dragleave', this.handleDragLeave.bind(this));

        // Make desk moveable (for repositioning)
        deskEl.addEventListener('mousedown', this.handleDeskMouseDown.bind(this));

        this.updateDeskContent(desk, deskEl);
        
        return deskEl;
    }

    updateDeskContent(desk, deskElement) {
        // Preserve removal button if it exists
        const existingRemoveBtn = deskElement.querySelector('.desk-remove-btn');
        
        deskElement.innerHTML = '';

        if (desk.students.length === 0) {
            // Empty desk - show desk number and type
            const label = document.createElement('div');
            label.className = 'desk-label';
            label.textContent = `${desk.type === 'single' ? 'Einzeltisch' : 'Doppeltisch'}`;
            deskElement.appendChild(label);
        } else {
            // Desk with students
            // For double desks, sort students by position to ensure consistent visual order
            let studentsToRender = [...desk.students];
            if (desk.type === 'double') {
                studentsToRender.sort((a, b) => {
                    // Left position comes first, then right, then undefined positions
                    const getPositionOrder = (position) => {
                        if (position === 'left') return 0;
                        if (position === 'right') return 1;
                        return 2; // undefined or other values
                    };
                    return getPositionOrder(a.deskPosition) - getPositionOrder(b.deskPosition);
                });
            }
            
            studentsToRender.forEach((student, index) => {
                const studentCard = this.createStudentCard(student);
                
                // For double desks, apply consistent positioning based on deskPosition property
                if (desk.type === 'double' && student.deskPosition) {
                    if (desk.students.length === 1) {
                        // Single student: consistent spacing based on position
                        if (student.deskPosition === 'left') {
                            studentCard.style.marginLeft = '18px';
                            studentCard.style.marginRight = 'auto';
                        } else if (student.deskPosition === 'right') {
                            studentCard.style.marginLeft = 'auto';
                            studentCard.style.marginRight = '18px';
                        }
                    } else if (desk.students.length === 2) {
                        // Two students: balanced spacing with 18px outer margins
                        if (student.deskPosition === 'left') {
                            studentCard.style.marginLeft = '18px';
                            studentCard.style.marginRight = '8px';
                        } else if (student.deskPosition === 'right') {
                            studentCard.style.marginLeft = '8px';
                            studentCard.style.marginRight = '18px';
                        }
                    }
                    
                    // Reset any conflicting styles that might interfere with drag
                    studentCard.style.position = '';
                    studentCard.style.transform = '';
                }
                
                deskElement.appendChild(studentCard);
            });
        }

        // Update styling based on occupancy
        deskElement.classList.toggle('occupied', desk.students.length > 0);
        deskElement.classList.toggle('full', desk.students.length >= desk.capacity);
        
        // Color coding: empty desks gray, occupied desks green
        deskElement.classList.toggle('desk-empty', desk.students.length === 0);
        deskElement.classList.toggle('desk-occupied', desk.students.length > 0);
        
        // Re-add removal button if we're in removal mode
        if (this.deskRemovalMode && existingRemoveBtn) {
            deskElement.appendChild(existingRemoveBtn);
        } else if (this.deskRemovalMode) {
            this.addRemovalButtonToDesk(desk);
        }
    }

    handleDeskMouseDown(event) {
        // Prevent desk movement during student drag operations
        if (this.draggedElement) {
            return;
        }
        
        const desk = this.getDeskFromElement(event.target);
        if (!desk) return;
        
        // Get the actual desk element (not a child element)
        const deskElement = event.target.closest('.desk');
        if (!deskElement) return;
        
        // Start desk dragging
        this.isDraggingDesk = true;
        this.currentDraggedDesk = desk;
        
        const rect = deskElement.getBoundingClientRect();
        const classroomRect = document.getElementById('classroomGrid').getBoundingClientRect();
        
        this.deskDragOffset = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
        
        deskElement.style.zIndex = '1000';
        
        // Add global mouse move and mouse up listeners
        document.addEventListener('mousemove', this.boundHandleDeskMouseMove);
        document.addEventListener('mouseup', this.boundHandleDeskMouseUp);
        
        event.preventDefault();
    }

    handleDeskMouseMove(event) {
        if (!this.isDraggingDesk || !this.currentDraggedDesk) return;
        
        const classroomRect = document.getElementById('classroomGrid').getBoundingClientRect();
        
        const newX = event.clientX - classroomRect.left - this.deskDragOffset.x;
        const newY = event.clientY - classroomRect.top - this.deskDragOffset.y;
        
        // Get actual desk element dimensions instead of using hard-coded values
        const deskElement = this.currentDraggedDesk.element;
        const deskRect = deskElement.getBoundingClientRect();
        const deskWidth = deskRect.width;
        const deskHeight = deskRect.height;
        
        // Keep desk within classroom bounds using actual dimensions
        const minX = 0;
        const minY = 0;
        const maxX = classroomRect.width - deskWidth;
        
        // Allow unlimited vertical movement - expand container if needed
        const proposedMaxY = newY + deskHeight;
        const classroom = document.getElementById('classroomGrid');
        if (proposedMaxY > classroom.clientHeight - 50) {
            // Expand the classroom container
            const newHeight = Math.max(classroom.clientHeight, proposedMaxY + 200);
            classroom.style.height = newHeight + 'px';
        }
        
        // Use a generous maxY that allows expansion
        const maxY = Math.max(classroomRect.height, classroom.clientHeight) - deskHeight;
        
        // Snap to grid first (25px grid for easy alignment)
        const gridSize = 25;
        let snappedX = Math.round(newX / gridSize) * gridSize;
        let snappedY = Math.round(newY / gridSize) * gridSize;
        
        // Then ensure bounds are respected after snapping
        const boundedX = Math.max(minX, Math.min(maxX, snappedX));
        const boundedY = Math.max(minY, Math.min(maxY, snappedY));
        
        // Check for collisions with other desks
        const wouldCollide = this.checkDeskCollision(boundedX, boundedY, deskWidth, deskHeight, this.currentDraggedDesk.id);
        
        if (!wouldCollide) {
            // Update desk position only if no collision
            this.currentDraggedDesk.element.style.left = boundedX + 'px';
            this.currentDraggedDesk.element.style.top = boundedY + 'px';
            
            // Update desk data
            this.currentDraggedDesk.x = boundedX;
            this.currentDraggedDesk.y = boundedY;
        }
    }

    checkDeskCollision(x, y, width, height, excludeDeskId) {
        // Check collision with all other desks
        for (const desk of this.desks) {
            if (desk.id === excludeDeskId) continue; // Skip the desk being moved
            
            const otherDeskElement = desk.element;
            if (!otherDeskElement) continue;
            
            const otherRect = otherDeskElement.getBoundingClientRect();
            const classroomRect = document.getElementById('classroomGrid').getBoundingClientRect();
            
            // Convert to relative coordinates
            const otherX = desk.x;
            const otherY = desk.y;
            const otherWidth = otherRect.width;
            const otherHeight = otherRect.height;
            
            // Check if rectangles overlap (with small margin for better UX)
            const margin = 5;
            if (x < otherX + otherWidth + margin &&
                x + width + margin > otherX &&
                y < otherY + otherHeight + margin &&
                y + height + margin > otherY) {
                return true; // Collision detected
            }
        }
        return false; // No collision
    }

    handleDeskMouseUp(event) {
        if (!this.isDraggingDesk) return;
        
        // Reset z-index
        if (this.currentDraggedDesk && this.currentDraggedDesk.element) {
            this.currentDraggedDesk.element.style.zIndex = '';
        }
        
        // Clean up
        this.isDraggingDesk = false;
        this.currentDraggedDesk = null;
        this.deskDragOffset = null;
        
        // Remove global listeners
        document.removeEventListener('mousemove', this.boundHandleDeskMouseMove);
        document.removeEventListener('mouseup', this.boundHandleDeskMouseUp);
        
        // Save state
        this.saveCurrentClassState();
    }

    getDeskFromElement(element) {
        const deskElement = element.closest('.desk');
        if (!deskElement) return null;
        
        const deskId = parseInt(deskElement.dataset.deskId);
        return this.desks.find(desk => desk.id === deskId);
    }

    addDesk(type) {
        // Find a free position for the new desk
        const deskWidth = type === 'single' ? 100 : 225;
        const deskHeight = 80;
        const freePosition = this.findFreePosition(deskWidth, deskHeight);
        
        if (!freePosition) {
            alert('Kein Platz verfügbar! Bitte verschieben Sie bestehende Tische oder vergrößern Sie das Klassenzimmer.');
            return;
        }
        
        const newDesk = {
            id: this.nextDeskId++,
            type: type,
            x: freePosition.x,
            y: freePosition.y,
            capacity: type === 'single' ? 1 : 2,
            students: [],
            element: null
        };
        
        this.desks.push(newDesk);
        
        const classroom = document.getElementById('classroomGrid');
        const deskElement = this.createDeskElement(newDesk);
        classroom.appendChild(deskElement);
        newDesk.element = deskElement;
        
        this.saveCurrentClassState();
    }

    findFreePosition(width, height) {
        const classroom = document.getElementById('classroomGrid');
        const classroomRect = classroom.getBoundingClientRect();
        const gridSize = 25;
        
        // Try positions in a grid pattern, starting from top-left
        for (let y = 0; y <= classroomRect.height - height; y += gridSize) {
            for (let x = 0; x <= classroomRect.width - width; x += gridSize) {
                // Check if this position would cause a collision
                if (!this.checkDeskCollision(x, y, width, height, -1)) {
                    return { x, y };
                }
            }
        }
        
        // If no free position found, return null
        return null;
    }

    enterDeskRemovalMode() {
        this.deskRemovalMode = true;
        this.showDeskRemovalButtons();
        document.getElementById('removeDesk').style.display = 'none';
        document.getElementById('exitRemovalMode').style.display = 'inline-block';
    }

    exitDeskRemovalMode() {
        this.deskRemovalMode = false;
        this.hideDeskRemovalButtons();
        document.getElementById('removeDesk').style.display = 'inline-block';
        document.getElementById('exitRemovalMode').style.display = 'none';
    }

    showDeskRemovalButtons() {
        this.desks.forEach(desk => {
            this.addRemovalButtonToDesk(desk);
        });
    }

    hideDeskRemovalButtons() {
        document.querySelectorAll('.desk-remove-btn').forEach(btn => {
            btn.remove();
        });
    }

    addRemovalButtonToDesk(desk) {
        if (desk.element && !desk.element.querySelector('.desk-remove-btn')) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'desk-remove-btn';
            removeBtn.innerHTML = '✖';
            removeBtn.title = 'Tisch entfernen';
            
            // Prevent drag events on remove button
            removeBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
            });
            removeBtn.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                e.preventDefault();
            });
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.removeDesk(desk.id);
            });
            
            // Position button in top-right corner of desk
            removeBtn.style.position = 'absolute';
            removeBtn.style.top = '-8px';
            removeBtn.style.right = '-8px';
            removeBtn.style.zIndex = '1000';
            
            // Desk is already absolute positioned, no need to change it
            desk.element.appendChild(removeBtn);
        }
    }

    removeDesk(deskId) {
        const deskIndex = this.desks.findIndex(desk => desk.id === deskId);
        if (deskIndex === -1) return;
        
        const desk = this.desks[deskIndex];
        
        // Move students back to pool
        desk.students.forEach(student => {
            // Student is already in this.students, just not assigned to any desk
        });
        
        // Remove desk element from DOM
        if (desk.element) {
            desk.element.remove();
        }
        
        // Remove from desks array
        this.desks.splice(deskIndex, 1);
        
        // If in removal mode, refresh the removal buttons
        if (this.deskRemovalMode) {
            this.hideDeskRemovalButtons();
            this.showDeskRemovalButtons();
        }
        
        // Update student pool
        this.renderStudentPool();
        this.saveCurrentClassState();
    }

    bindEvents() {
        document.getElementById('addStudent').addEventListener('click', () => {
            document.getElementById('studentModal').style.display = 'block';
        });


        document.getElementById('cancelModal').addEventListener('click', () => {
            document.getElementById('studentModal').style.display = 'none';
            this.clearForm();
        });

        document.getElementById('resetSeats').addEventListener('click', () => {
            if (confirm('Möchten Sie wirklich alle Plätze zurücksetzen? Alle Schüler werden zurück in die Schülerliste verschoben.')) {
                this.resetAllDesks();
            }
        });

        document.getElementById('resetLateness').addEventListener('click', () => {
            if (confirm('Möchten Sie wirklich alle Verspätungen zurücksetzen? Alle Verspätungsdaten für alle Schüler werden gelöscht.')) {
                this.resetAllLateness();
            }
        });

        document.getElementById('resetCounters').addEventListener('click', () => {
            this.resetAllCounters();
        });

        document.getElementById('studentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addStudent();
        });


        // Desk management events
        document.getElementById('addSingleDesk').addEventListener('click', () => {
            this.addDesk('single');
        });

        document.getElementById('addDoubleDesk').addEventListener('click', () => {
            this.addDesk('double');
        });

        document.getElementById('removeDesk').addEventListener('click', () => {
            this.enterDeskRemovalMode();
        });

        document.getElementById('exitRemovalMode').addEventListener('click', () => {
            this.exitDeskRemovalMode();
        });

        // Student pool drop handlers for drag and drop back to pool
        const studentPool = document.getElementById('studentPool');
        studentPool.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            studentPool.classList.add('drag-over');
        });

        studentPool.addEventListener('dragleave', (e) => {
            // Only remove if leaving the actual pool element (not child elements)
            if (!studentPool.contains(e.relatedTarget)) {
                studentPool.classList.remove('drag-over');
            }
        });

        studentPool.addEventListener('drop', (e) => {
            e.preventDefault();
            studentPool.classList.remove('drag-over');
            
            if (this.draggedElement) {
                const studentId = this.draggedElement.dataset.studentId;
                this.moveStudentToPool(studentId);
            }
        });

        document.getElementById('deleteStudent').addEventListener('click', () => {
            this.deleteCurrentStudent();
        });

        document.getElementById('toggleSidebar').addEventListener('click', () => {
            this.toggleSidebar();
        });

        document.getElementById('toggleHeader').addEventListener('click', () => {
            this.toggleHeader();
        });

        document.getElementById('toggleGrades').addEventListener('click', () => {
            this.toggleGradeDisplay();
        });

        document.getElementById('startGrade4').addEventListener('click', () => {
            this.setStartingGrade(4.0);
        });

        document.getElementById('startGrade35').addEventListener('click', () => {
            this.setStartingGrade(3.5);
        });

        document.getElementById('showGradeTable').addEventListener('click', () => {
            this.showExtendedGradeTable();
        });

        document.getElementById('addToGradeTable').addEventListener('click', () => {
            this.addDateColumnToGradeTable();
        });

        document.getElementById('closeGradeTable').addEventListener('click', () => {
            document.getElementById('gradeTableModal').style.display = 'none';
        });

        document.getElementById('exportGradePDF').addEventListener('click', () => {
            this.exportGradesToPDF();
        });

        document.getElementById('exportGradeExcel').addEventListener('click', () => {
            this.exportGradesToExcel();
        });

        // Class management events
        document.getElementById('addClass').addEventListener('click', () => {
            this.openClassModal('add');
        });

        document.getElementById('editClass').addEventListener('click', () => {
            this.openClassModal('edit');
        });

        document.getElementById('cancelClassModal').addEventListener('click', () => {
            document.getElementById('classModal').style.display = 'none';
            document.getElementById('classForm').reset();
            this.isEditingClass = false;
            this.editingClassId = null;
        });

        document.getElementById('classForm').addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.isEditingClass) {
                this.updateClass();
            } else {
                this.addClass();
            }
        });

        document.getElementById('classSelect').addEventListener('change', (e) => {
            this.switchClass(e.target.value);
        });

        document.getElementById('deleteClass').addEventListener('click', () => {
            this.deleteCurrentClass();
        });

        const exportBtn = document.getElementById('exportData');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        } else {
            console.warn('#exportData button not found in DOM');
        }

        document.getElementById('importData').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });

        document.getElementById('importFile').addEventListener('change', (e) => {
            this.importData(e.target.files[0]);
        });

        document.getElementById('importImagesBtn').addEventListener('click', () => {
            document.getElementById('importImages').click();
        });

        document.getElementById('importImages').addEventListener('change', (e) => {
            this.importImages(e.target.files);
        });

        // Dropdown menu functionality
        document.getElementById('moreOptions').addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('dropdownContent');
            dropdown.classList.toggle('show');
        });

        // Class options dropdown
        document.getElementById('classOptions').addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('classDropdownContent');
            dropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown-menu')) {
                document.getElementById('dropdownContent').classList.remove('show');
            }
            if (!e.target.closest('.class-dropdown-menu')) {
                document.getElementById('classDropdownContent').classList.remove('show');
            }
        });

        // Close modal on background click
        document.getElementById('studentModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                document.getElementById('studentModal').style.display = 'none';
                this.clearForm();
            }
        });

        document.getElementById('classModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                document.getElementById('classModal').style.display = 'none';
                document.getElementById('classForm').reset();
                this.isEditingClass = false;
                this.editingClassId = null;
            }
        });

        document.getElementById('gradeTableModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                document.getElementById('gradeTableModal').style.display = 'none';
            }
        });

        // Set up event delegation for checkbox events (absence and lateness)
        this.setupCheckboxEventDelegation();

        // Set up lateness modal events
        this.setupLatenessModalEvents();
    }

    setupLatenessModalEvents() {
        // Close modal on background click
        document.getElementById('latenessModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                document.getElementById('latenessModal').style.display = 'none';
            }
        });

        // Close modal on cancel button
        document.getElementById('cancelLatenessModal').addEventListener('click', () => {
            document.getElementById('latenessModal').style.display = 'none';
        });

        // Handle lateness selection buttons
        document.querySelectorAll('.lateness-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const studentId = parseInt(document.getElementById('latenessModal').dataset.studentId);
                const latenessLevel = parseInt(e.currentTarget.dataset.lateness);
                this.setStudentLateness(studentId, latenessLevel);
                document.getElementById('latenessModal').style.display = 'none';
            });
        });
    }

    showLatenessModal(studentId) {
        document.getElementById('latenessModal').dataset.studentId = studentId;
        document.getElementById('latenessModal').style.display = 'block';
    }

    setStudentLateness(studentId, latenessLevel) {
        // Get current date for today's lateness
        const today = new Date().toLocaleDateString('de-DE');
        
        // Initialize lateness table if not exists
        if (!this.latenessTable.has(studentId)) {
            this.latenessTable.set(studentId, new Map());
        }
        
        const studentLateness = this.latenessTable.get(studentId);
        
        // Update or remove today's lateness level
        if (latenessLevel === 0) {
            studentLateness.delete(today);
        } else {
            studentLateness.set(today, latenessLevel);
        }
        
        // Immediately update specific student's visual indicators
        this.updateStudentLatenessVisuals(studentId);
        
        // Save state and update UI
        this.saveCurrentClassState();
    }

    updateStudentLatenessVisuals(studentId) {
        // Find the student data
        const student = this.students.find(s => s.id === studentId);
        if (!student) return;

        // Get current lateness level
        const latenessLevel = this.getCurrentLatenessLevel(studentId);

        // Update student card in desks
        this.desks.forEach(desk => {
            if (desk.students.some(s => s.id === studentId)) {
                this.updateDeskContent(desk, desk.element);
            }
        });

        // Update student card in student pool (if the student is unassigned)
        const isAssigned = this.desks.some(desk => desk.students.some(s => s.id === studentId));
        if (!isAssigned) {
            this.renderStudentPool();
        }
    }

    setLateness(studentId, dateColumn, latenessLevel) {
        // Initialize lateness table if not exists
        if (!this.latenessTable.has(studentId)) {
            this.latenessTable.set(studentId, new Map());
        }
        
        const studentLateness = this.latenessTable.get(studentId);
        
        // Update or remove lateness level for specific date
        if (latenessLevel === 0) {
            studentLateness.delete(dateColumn);
        } else {
            studentLateness.set(dateColumn, latenessLevel);
        }
        
        // Save state and refresh table
        this.saveCurrentClassState();
        this.showExtendedGradeTable();
    }

    getCurrentLatenessLevel(studentId) {
        // Get today's lateness level for visual display on student cards
        const studentLateness = this.latenessTable.get(studentId);
        if (!studentLateness || studentLateness.size === 0) {
            return 0;
        }
        
        // First try to get today's lateness
        const today = new Date().toLocaleDateString('de-DE');
        if (studentLateness.has(today)) {
            return studentLateness.get(today);
        }
        
        // If no entry for today, get the most recent lateness level
        const sortedEntries = Array.from(studentLateness.entries()).sort((a, b) => {
            const dateA = new Date(a[0].split('.').reverse().join('-'));
            const dateB = new Date(b[0].split('.').reverse().join('-'));
            return dateB - dateA;
        });
        
        return sortedEntries.length > 0 ? sortedEntries[0][1] : 0;
    }

    countStudentLateness(studentId) {
        // Count the total number of times a student was late (regardless of minutes)
        const studentLateness = this.latenessTable.get(studentId);
        if (!studentLateness) {
            return 0;
        }
        
        // Count entries where lateness level > 0
        let count = 0;
        studentLateness.forEach(latenessLevel => {
            if (latenessLevel > 0) {
                count++;
            }
        });
        
        return count;
    }

    countStudentAbsences(studentId) {
        // Count the total number of times a student was absent
        const studentAbsences = this.absenceTable.get(studentId);
        if (!studentAbsences) {
            return 0;
        }
        
        // Count entries where absence is true
        let count = 0;
        studentAbsences.forEach(isAbsent => {
            if (isAbsent === true) {
                count++;
            }
        });
        
        return count;
    }

    loadClasses() {
        const savedClasses = localStorage.getItem('seatingPlan_classes');
        if (savedClasses) {
            const classesData = JSON.parse(savedClasses);
            this.classes = new Map(classesData.map(cls => [cls.id, cls]));
            
            // Normalize all classes data types after loading from localStorage
            let migrationOccurred = false;
            this.classes.forEach((classData, classId) => {
                classData.studentCounters = new Map(classData.studentCounters || []);
                classData.deskAssignments = new Map(classData.deskAssignments || []);
                // Handle legacy seatAssignments
                if (classData.seatAssignments && !classData.deskAssignments) {
                    classData.deskAssignments = new Map();
                }
                // Migrate old classes to include defaultPeriodLength
                if (!classData.defaultPeriodLength) {
                    classData.defaultPeriodLength = 1;
                    migrationOccurred = true;
                }
            });
            
            // Save classes if migration occurred
            if (migrationOccurred) {
                this.saveClasses();
            }
            
            // Automatically select the first available class after loading
            if (this.classes.size > 0) {
                const firstClassId = this.classes.keys().next().value;
                this.switchClass(firstClassId);
            }
        }
    }

    migrateGermanGradesToNumeric() {
        // One-time migration to convert German comma grades to numeric values
        let needsSave = false;
        
        this.gradeTable.forEach((studentGrades, studentId) => {
            studentGrades.forEach((grade, column) => {
                if (typeof grade === 'string' && grade.includes(',')) {
                    const numericGrade = parseFloat(grade.replace(',', '.'));
                    if (!isNaN(numericGrade)) {
                        studentGrades.set(column, numericGrade);
                        needsSave = true;
                    }
                }
            });
        });
        
        // Also migrate hidden grades
        this.hiddenGrades.forEach((studentHiddenGrades, studentId) => {
            studentHiddenGrades.forEach((grade, column) => {
                if (typeof grade === 'string' && grade.includes(',')) {
                    const numericGrade = parseFloat(grade.replace(',', '.'));
                    if (!isNaN(numericGrade)) {
                        studentHiddenGrades.set(column, numericGrade);
                        needsSave = true;
                    }
                }
            });
        });
        
        if (needsSave) {
            this.saveCurrentClassState();
        }
    }

    createDefaultClass() {
        const defaultClass = {
            id: 'default_' + Date.now(),
            name: 'Meine Klasse',
            students: [],
            studentCounters: new Map(),
            deskAssignments: new Map(),
            desks: [], // Explicitly empty - no default desks
            gridRows: 5,
            gridColumns: 6,
            showGrades: false,
            startingGrade: 4.0,
            defaultPeriodLength: 1,
            gradeTable: new Map(),
            absenceTable: new Map(),
            latenessTable: new Map(),
            hiddenGrades: new Map(),
            periods: new Map(),
            activePeriodId: null
        };

        this.classes.set(defaultClass.id, defaultClass);
        this.currentClassId = defaultClass.id;
        this.switchClass(defaultClass.id);
        this.saveClasses();
    }

    addClass() {
        const className = document.getElementById('className').value.trim();
        const periodLength = parseInt(document.getElementById('periodLength').value);
        
        if (!className) return;

        const newClass = {
            id: 'class_' + Date.now(),
            name: className,
            students: [],
            studentCounters: new Map(),
            deskAssignments: new Map(),
            desks: [],
            gridRows: 5,
            gridColumns: 6,
            showGrades: false,
            startingGrade: 4.0,
            defaultPeriodLength: periodLength || 1,
            gradeTable: new Map(),
            absenceTable: new Map(),
            latenessTable: new Map(),
            hiddenGrades: new Map(),
            periods: new Map(),
            activePeriodId: null
        };

        this.classes.set(newClass.id, newClass);
        this.saveClasses();
        this.updateClassSelect();

        // Switch to the new class
        this.switchClass(newClass.id);

        document.getElementById('classModal').style.display = 'none';
        document.getElementById('classForm').reset();
        this.isEditingClass = false;
        this.editingClassId = null;
    }

    openClassModal(mode) {
        if (mode === 'edit') {
            if (!this.currentClassId) return;
            
            this.isEditingClass = true;
            this.editingClassId = this.currentClassId;
            
            const classData = this.classes.get(this.currentClassId);
            document.getElementById('className').value = classData.name;
            document.getElementById('periodLength').value = classData.defaultPeriodLength || 1;
            document.getElementById('classModalTitle').textContent = 'Klasse bearbeiten';
            document.getElementById('submitClassButton').textContent = 'Speichern';
        } else {
            this.isEditingClass = false;
            this.editingClassId = null;
            
            document.getElementById('className').value = '';
            document.getElementById('periodLength').value = '1';
            document.getElementById('classModalTitle').textContent = 'Neue Klasse anlegen';
            document.getElementById('submitClassButton').textContent = 'Anlegen';
        }
        
        document.getElementById('classModal').style.display = 'block';
    }

    updateClass() {
        const newClassName = document.getElementById('className').value.trim();
        const periodLength = parseInt(document.getElementById('periodLength').value);
        
        if (!newClassName || !this.editingClassId) return;

        const classData = this.classes.get(this.editingClassId);
        classData.name = newClassName;
        classData.defaultPeriodLength = periodLength || 1;
        
        this.classes.set(this.editingClassId, classData);
        this.saveClasses();
        this.updateClassSelect();

        document.getElementById('classModal').style.display = 'none';
        document.getElementById('classForm').reset();
        this.isEditingClass = false;
        this.editingClassId = null;
    }

    switchClass(classId) {
        if (!classId || !this.classes.has(classId)) {
            this.currentClassId = null;
            this.students = [];
            this.studentCounters = new Map();
            document.getElementById('editClass').style.display = 'none';
            document.getElementById('deleteClass').style.display = 'none';
            this.updateUI();
            return;
        }

        // Save current class state
        if (this.currentClassId && this.classes.has(this.currentClassId)) {
            this.saveCurrentClassState();
        }

        // Load new class
        this.currentClassId = classId;
        const classData = this.classes.get(classId);

        this.students = classData.students || [];
        this.studentCounters = new Map(classData.studentCounters || []);
        // Create fresh desk objects from saved data (without element references)
        this.desks = (classData.desks || []).map(deskData => ({
            id: deskData.id,
            type: deskData.type,
            x: deskData.x,
            y: deskData.y,
            capacity: deskData.capacity,
            students: [], // Will be populated by loadDeskAssignments
            element: null // Will be set by renderDesks
        }));
        this.gridRows = classData.gridRows || 5;
        this.gridColumns = classData.gridColumns || 6;
        this.showGrades = classData.showGrades || false;
        this.startingGrade = classData.startingGrade || 4.0;
        // Properly reconstruct nested Map structure for gradeTable
        this.gradeTable = new Map();
        if (classData.gradeTable && Array.isArray(classData.gradeTable)) {
            classData.gradeTable.forEach(([studentId, gradesData]) => {
                // Reconstruct inner Map from the saved array
                const studentGradesMap = new Map(gradesData || []);
                this.gradeTable.set(studentId, studentGradesMap);
            });
        }
        
        // Properly reconstruct nested Map structure for absenceTable
        this.absenceTable = new Map();
        if (classData.absenceTable && Array.isArray(classData.absenceTable)) {
            classData.absenceTable.forEach(([studentId, absenceData]) => {
                // Reconstruct inner Map from the saved array
                const studentAbsenceMap = new Map(absenceData || []);
                this.absenceTable.set(studentId, studentAbsenceMap);
            });
        }

        // Properly reconstruct nested Map structure for latenessTable
        this.latenessTable = new Map();
        if (classData.latenessTable && Array.isArray(classData.latenessTable)) {
            classData.latenessTable.forEach(([studentId, latenessData]) => {
                // Reconstruct inner Map from the saved array
                const studentLatenessMap = new Map(latenessData || []);
                this.latenessTable.set(studentId, studentLatenessMap);
            });
        }

        
        // Properly reconstruct nested Map structure for hiddenGrades
        this.hiddenGrades = new Map();
        if (classData.hiddenGrades && Array.isArray(classData.hiddenGrades)) {
            classData.hiddenGrades.forEach(([studentId, hiddenData]) => {
                // Reconstruct inner Map from the saved array
                const studentHiddenMap = new Map(hiddenData || []);
                this.hiddenGrades.set(studentId, studentHiddenMap);
            });
        }
        
        // Properly reconstruct periods Map
        this.periods = new Map();
        if (classData.periods && Array.isArray(classData.periods)) {
            classData.periods.forEach(([periodId, periodData]) => {
                this.periods.set(periodId, periodData);
            });
        }
        this.activePeriodId = classData.activePeriodId || null;
        
        // Migration: Convert existing grade columns to 1-day periods if no periods exist
        if (this.periods.size === 0 && this.gradeTable.size > 0) {
            this.migrateExistingGradesToPeriods();
        }
        
        // Migration: Convert German comma grades to numeric values
        this.migrateGermanGradesToNumeric();

        // Initialize nextDeskId based on existing desks to avoid ID conflicts
        if (this.desks.length > 0) {
            // First pass: collect valid numeric IDs and find maximum
            const validIds = this.desks
                .map(desk => desk.id)
                .filter(id => typeof id === 'number' && !isNaN(id) && id >= 0);
            
            const maxId = validIds.length > 0 ? Math.max(...validIds) : -1;
            this.nextDeskId = maxId + 1;
            
            // Second pass: migrate duplicate or invalid desk IDs
            const seenIds = new Set();
            this.desks.forEach(desk => {
                if (typeof desk.id !== 'number' || isNaN(desk.id) || desk.id < 0 || seenIds.has(desk.id)) {
                    // Assign new unique ID to duplicate or invalid desk
                    desk.id = this.nextDeskId++;
                }
                seenIds.add(desk.id);
            });
        } else {
            this.nextDeskId = 0;
        }

        // Update UI
        this.createClassroom();
        
        // Load student assignments from saved desk data AFTER desks are rendered
        this.loadStudentAssignments(classData.desks || []);
        
        // Update desk contents to reflect loaded assignments
        this.desks.forEach(desk => {
            if (desk.element) {
                this.updateDeskContent(desk, desk.element);
            }
        });
        
        this.updateUI();
        
        // Save migrated data to persist any ID fixes
        this.saveCurrentClassState();

        // Update class selector
        document.getElementById('classSelect').value = classId;
        document.getElementById('editClass').style.display = this.currentClassId ? 'inline-block' : 'none';
        document.getElementById('deleteClass').style.display = this.classes.size > 1 ? 'inline-block' : 'none';
        
        // Update period info display
        this.updatePeriodInfo();
    }

    saveCurrentClassState() {
        if (!this.currentClassId || !this.classes.has(this.currentClassId)) return;

        const classData = this.classes.get(this.currentClassId);
        classData.students = this.students;
        classData.studentCounters = this.studentCounters;
        // Remove DOM element references and store only student IDs to prevent JSON.stringify errors
        classData.desks = this.desks.map(desk => ({
            id: desk.id,
            type: desk.type,
            x: desk.x,
            y: desk.y,
            capacity: desk.capacity,
            students: desk.students.map(student => ({
                id: student.id,
                deskPosition: student.deskPosition
            }))
            // element property excluded - will be rebuilt on load
        }));
        classData.deskAssignments = this.getDeskAssignments();
        classData.gridRows = this.gridRows;
        classData.gridColumns = this.gridColumns;
        classData.showGrades = this.showGrades;
        classData.startingGrade = this.startingGrade;
        // Properly serialize nested Map structure for gradeTable
        classData.gradeTable = Array.from(this.gradeTable.entries()).map(([studentId, studentGradesMap]) => {
            return [studentId, Array.from(studentGradesMap.entries())];
        });
        
        // Properly serialize nested Map structure for absenceTable
        classData.absenceTable = Array.from(this.absenceTable.entries()).map(([studentId, studentAbsenceMap]) => {
            return [studentId, Array.from(studentAbsenceMap.entries())];
        });

        // Properly serialize nested Map structure for latenessTable
        classData.latenessTable = Array.from(this.latenessTable.entries()).map(([studentId, studentLatenessMap]) => {
            return [studentId, Array.from(studentLatenessMap.entries())];
        });

        
        // Properly serialize nested Map structure for hiddenGrades
        classData.hiddenGrades = Array.from(this.hiddenGrades.entries()).map(([studentId, studentHiddenMap]) => {
            return [studentId, Array.from(studentHiddenMap.entries())];
        });
        
        // Properly serialize periods Map
        classData.periods = Array.from(this.periods.entries());
        classData.activePeriodId = this.activePeriodId;

        this.classes.set(this.currentClassId, classData);
        this.saveClasses();
    }

    getDeskAssignments() {
        const assignments = new Map();
        this.desks.forEach((desk, index) => {
            if (desk.students.length > 0) {
                assignments.set(index, desk.students.map(s => s.id));
            }
        });
        return assignments;
    }

    loadStudentAssignments(savedDesks) {
        // Load student assignments from saved desk data
        savedDesks.forEach(savedDesk => {
            const desk = this.desks.find(d => d.id === savedDesk.id);
            if (desk && savedDesk.students) {
                desk.students = [];
                savedDesk.students.forEach(savedStudent => {
                    const student = this.students.find(s => s.id == savedStudent.id);
                    if (student && desk.students.length < desk.capacity) {
                        // Restore desk position if it exists
                        if (savedStudent.deskPosition) {
                            student.deskPosition = savedStudent.deskPosition;
                        }
                        desk.students.push(student);
                    }
                });
            }
        });
    }

    loadDeskAssignments(assignments) {
        assignments.forEach((studentIds, deskIndex) => {
            if (this.desks[deskIndex]) {
                const desk = this.desks[deskIndex];
                desk.students = [];
                studentIds.forEach(studentId => {
                    const student = this.students.find(s => s.id == studentId);
                    if (student && desk.students.length < desk.capacity) {
                        desk.students.push(student);
                    }
                });
                // Only update desk content if the element exists
                if (desk.element) {
                    this.updateDeskContent(desk, desk.element);
                }
            }
        });
    }

    updateClassSelect() {
        const select = document.getElementById('classSelect');
        select.innerHTML = '<option value="">Klasse auswählen...</option>';

        // Convert classes Map to array and sort with natural number ordering
        const sortedClasses = Array.from(this.classes.entries()).sort((a, b) => {
            return this.naturalSort(a[1].name, b[1].name);
        });

        sortedClasses.forEach(([id, classData]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = classData.name;
            select.appendChild(option);
        });

        if (this.currentClassId) {
            select.value = this.currentClassId;
        }
    }

    naturalSort(a, b) {
        // Split strings into chunks of letters and numbers
        const chunksA = a.match(/(\d+|\D+)/g) || [];
        const chunksB = b.match(/(\d+|\D+)/g) || [];
        
        const maxLength = Math.max(chunksA.length, chunksB.length);
        
        for (let i = 0; i < maxLength; i++) {
            const chunkA = chunksA[i] || '';
            const chunkB = chunksB[i] || '';
            
            // Check if both chunks are numbers
            const isNumberA = /^\d+$/.test(chunkA);
            const isNumberB = /^\d+$/.test(chunkB);
            
            if (isNumberA && isNumberB) {
                // Compare as numbers
                const numA = parseInt(chunkA, 10);
                const numB = parseInt(chunkB, 10);
                if (numA !== numB) {
                    return numA - numB;
                }
            } else {
                // Compare as strings (case-insensitive, German locale)
                const result = chunkA.localeCompare(chunkB, 'de', { sensitivity: 'base' });
                if (result !== 0) {
                    return result;
                }
            }
        }
        
        return 0;
    }

    deleteCurrentClass() {
        if (!this.currentClassId || this.classes.size <= 1) return;

        const classData = this.classes.get(this.currentClassId);
        if (confirm(`Möchten Sie die Klasse "${classData.name}" wirklich löschen?`)) {
            this.classes.delete(this.currentClassId);
            this.saveClasses();

            // Switch to first available class
            const firstClassId = this.classes.keys().next().value;
            this.switchClass(firstClassId);
            this.updateClassSelect();
        }
    }

    saveClasses() {
        const classesData = Array.from(this.classes.entries()).map(([id, classData]) => ({
            ...classData,
            studentCounters: Array.from(classData.studentCounters.entries()),
            deskAssignments: Array.from(classData.deskAssignments.entries())
        }));
        localStorage.setItem('seatingPlan_classes', JSON.stringify(classesData));
    }

    // Periodenverwaltung Methods
    createNewPeriod(firstColumnName) {
        if (!this.currentClassId) return null;
        
        const classData = this.classes.get(this.currentClassId);
        const periodLength = classData.defaultPeriodLength || 1;
        
        const periodId = 'period_' + Date.now();
        const periodNumber = this.periods.size + 1;
        
        const newPeriod = {
            id: periodId,
            name: `Periode ${periodNumber}`,
            columns: [firstColumnName],
            maxColumns: periodLength,
            active: true
        };
        
        // Deactivate previous active period
        this.periods.forEach(period => {
            period.active = false;
        });
        
        this.periods.set(periodId, newPeriod);
        this.activePeriodId = periodId;
        
        // Update period info display
        this.updatePeriodInfo();
        
        return newPeriod;
    }

    updatePeriodInfo() {
        const periodInfoElement = document.getElementById('periodInfo');
        const periodTextElement = document.getElementById('periodText');
        
        if (!this.currentClassId || !this.activePeriodId) {
            periodInfoElement.style.display = 'none';
            return;
        }
        
        const currentPeriod = this.periods.get(this.activePeriodId);
        const currentClass = this.classes.get(this.currentClassId);
        
        if (!currentPeriod) {
            periodInfoElement.style.display = 'none';
            return;
        }
        
        // Format period information - extract number from period name (e.g., "Periode 1" -> "1")
        const periodNumber = currentPeriod.name.replace(/^Periode\s*/, '') || currentPeriod.name;
        const periodInfo = `${periodNumber} (${currentPeriod.columns.length}/${currentPeriod.maxColumns} Tage)`;
        const defaultPeriodLength = currentClass.defaultPeriodLength || 1;
        const periodConfig = defaultPeriodLength > 1 ? ` | Standard: ${defaultPeriodLength} Tage` : '';
        
        periodTextElement.textContent = periodInfo + periodConfig;
        periodInfoElement.style.display = 'block';
    }
    
    addColumnToPeriod(columnName, periodId = null) {
        const targetPeriodId = periodId || this.activePeriodId;
        if (!targetPeriodId || !this.periods.has(targetPeriodId)) {
            return false;
        }
        
        const period = this.periods.get(targetPeriodId);
        if (period.columns.length >= period.maxColumns) {
            return false; // Period is already full
        }
        
        period.columns.push(columnName);
        
        // Update period info display
        this.updatePeriodInfo();
        
        return true;
    }
    
    isPeriodComplete(periodId = null) {
        const targetPeriodId = periodId || this.activePeriodId;
        if (!targetPeriodId || !this.periods.has(targetPeriodId)) {
            return false;
        }
        
        const period = this.periods.get(targetPeriodId);
        return period.columns.length >= period.maxColumns;
    }
    
    shouldCreateNewPeriod() {
        if (!this.activePeriodId) {
            return true; // No active period
        }
        
        return this.isPeriodComplete();
    }
    
    calculatePeriodGrade(studentId, periodId) {
        if (!this.periods.has(periodId)) {
            return null;
        }
        
        const period = this.periods.get(periodId);
        const studentGrades = this.gradeTable.get(studentId);
        const studentAbsences = this.absenceTable.get(studentId);
        
        if (!studentGrades) {
            return null; // No grades available
        }
        
        // Check if student was absent for ALL days in this period
        let absentDays = 0;
        let totalDays = period.columns.length;
        
        period.columns.forEach(column => {
            if (studentAbsences && studentAbsences.get(column)) {
                absentDays++;
            }
        });
        
        // If student was absent for all days in the period, return null (no grade)
        if (absentDays === totalDays) {
            return null;
        }
        
        const validGrades = [];
        
        period.columns.forEach(column => {
            // Skip if student was absent for this column
            if (studentAbsences && studentAbsences.get(column)) {
                return;
            }
            
            if (studentGrades.has(column)) {
                const grade = parseFloat(studentGrades.get(column));
                if (!isNaN(grade)) {
                    validGrades.push(grade);
                }
            }
        });
        
        if (validGrades.length === 0) {
            return null; // No valid grades for this period
        }
        
        // Calculate simple mathematical average of all grades in the period
        const average = validGrades.reduce((sum, grade) => sum + grade, 0) / validGrades.length;
        return parseFloat(average.toFixed(1));
    }
    
    generatePeriodGroups(sortedDateColumns) {
        const groups = [];
        
        // If no periods exist, create groups for individual columns
        if (this.periods.size === 0) {
            sortedDateColumns.forEach(dateColumn => {
                groups.push({
                    name: 'Einzeltag',
                    columns: [dateColumn],
                    periodId: null
                });
            });
            return groups;
        }
        
        
        // Group columns by their periods
        const sortedPeriods = Array.from(this.periods.entries()).map(([periodId, period]) => ({
            id: periodId,
            ...period
        })).sort((a, b) => {
            // Sort by first column date if possible
            const firstDateA = a.columns[0];
            const firstDateB = b.columns[0];
            
            const parseGermanDate = (dateStr) => {
                const parts = dateStr.split(/[.\/]/);
                if (parts.length >= 2) {
                    const day = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1;
                    const year = parts.length >= 3 ? parseInt(parts[2]) : new Date().getFullYear();
                    if (!isNaN(day) && !isNaN(month)) {
                        return new Date(year, month, day);
                    }
                }
                return new Date(dateStr); // Fallback
            };
            
            return parseGermanDate(firstDateA) - parseGermanDate(firstDateB);
        });
        
        sortedPeriods.forEach(period => {
            const filteredColumns = period.columns.filter(col => sortedDateColumns.includes(col));
            if (filteredColumns.length > 0) {
                groups.push({
                    name: period.name,
                    columns: filteredColumns,
                    periodId: period.id
                });
            }
        });
        
        // Add any orphaned columns (not in any period)
        const periodsColumns = new Set();
        sortedPeriods.forEach(period => {
            period.columns.forEach(col => periodsColumns.add(col));
        });
        
        const orphanedColumns = sortedDateColumns.filter(col => !periodsColumns.has(col));
        if (orphanedColumns.length > 0) {
            orphanedColumns.forEach(col => {
                groups.push({
                    name: 'Einzeltag',
                    columns: [col],
                    periodId: null
                });
            });
        }
        
        return groups;
    }
    
    calculateStudentAverage(studentId) {
        // If no periods exist, use old single-day calculation
        if (this.periods.size === 0) {
            const studentGrades = this.gradeTable.get(studentId) || new Map();
            const studentAbsences = this.absenceTable.get(studentId) || new Map();
            
            const grades = Array.from(studentGrades.entries())
                .filter(([dateColumn, grade]) => !studentAbsences.get(dateColumn)) // Exclude absent days
                .map(([, grade]) => parseFloat(grade))
                .filter(g => !isNaN(g));
            return grades.length > 0 ? (grades.reduce((sum, g) => sum + g, 0) / grades.length).toFixed(1) : '-';
        }
        
        // Calculate average based on period grades
        // Each period counts equally, regardless of whether it's complete or incomplete
        const periodGrades = [];
        
        this.periods.forEach((period, periodId) => {
            const periodGrade = this.calculatePeriodGrade(studentId, periodId);
            // Only include periods where student was present for at least one day
            // (calculatePeriodGrade returns null if absent for all days)
            if (periodGrade !== null && !isNaN(periodGrade)) {
                periodGrades.push(periodGrade);
            }
        });
        
        // If student has no valid period grades, return '-'
        if (periodGrades.length === 0) {
            return '-';
        }
        
        // Calculate simple average of period grades
        // Complete and incomplete periods are weighted equally
        const average = periodGrades.reduce((sum, grade) => sum + grade, 0) / periodGrades.length;
        return average.toFixed(1);
    }
    
    migrateExistingGradesToPeriods() {
        // Get all existing date columns from grade table
        const dateColumns = new Set();
        this.gradeTable.forEach(studentGrades => {
            studentGrades.forEach((grade, dateColumn) => {
                dateColumns.add(dateColumn);
            });
        });
        
        // Sort date columns - try date parsing first, fallback to string sort
        const sortedDateColumns = Array.from(dateColumns).sort((a, b) => {
            // Try to parse as German date format (dd.mm.yyyy or dd/mm/yyyy)
            const parseGermanDate = (dateStr) => {
                const parts = dateStr.split(/[.\/]/);
                if (parts.length === 3) {
                    const day = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1; // Month is 0-indexed in Date
                    const year = parseInt(parts[2]);
                    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                        return new Date(year, month, day);
                    }
                }
                return null;
            };
            
            const dateA = parseGermanDate(a);
            const dateB = parseGermanDate(b);
            
            if (dateA && dateB) {
                return dateA - dateB; // Date comparison
            }
            
            return a.localeCompare(b); // Fallback to string comparison
        });
        
        // Create a 1-day period for each existing date column
        sortedDateColumns.forEach((dateColumn, index) => {
            const periodId = 'period_migration_' + Date.now() + '_' + index;
            const periodNumber = index + 1;
            
            const period = {
                id: periodId,
                name: `Periode ${periodNumber}`,
                columns: [dateColumn],
                maxColumns: 1,
                active: false // All migrated periods are inactive
            };
            
            this.periods.set(periodId, period);
        });
        
        // Set the last period as active if any exist
        if (sortedDateColumns.length > 0) {
            const lastPeriodId = Array.from(this.periods.keys()).pop();
            this.periods.get(lastPeriodId).active = true;
            this.activePeriodId = lastPeriodId;
        }
        
        console.log(`Migration: ${sortedDateColumns.length} existing date columns converted to 1-day periods`);
        
        // Save the migrated periods
        this.saveCurrentClassState();
    }

    updateUI() {
        this.renderStudentPool();
        this.updateGradeDisplay();
        this.updateStartingGradeButtons();
        this.updatePeriodInfo();
    }

    updateGradeDisplay() {
        const toggleBtn = document.getElementById('toggleGrades');
        const gradeTableBtn = document.getElementById('showGradeTable');

        if (this.showGrades) {
            toggleBtn.textContent = 'Zähler anzeigen';
            toggleBtn.style.background = '#34c759';
            toggleBtn.style.color = 'white';
            gradeTableBtn.style.display = 'inline-block';
            document.getElementById('addToGradeTable').style.display = 'inline-block';
        } else {
            toggleBtn.textContent = 'Noten anzeigen';
            toggleBtn.style.background = '';
            toggleBtn.style.color = '';
            gradeTableBtn.style.display = 'none';
            document.getElementById('addToGradeTable').style.display = 'none';
        }
    }

    updateStartingGradeButtons() {
        document.getElementById('startGrade4').style.background = this.startingGrade === 4.0 ? '#007aff' : '';
        document.getElementById('startGrade4').style.color = this.startingGrade === 4.0 ? 'white' : '';
        document.getElementById('startGrade35').style.background = this.startingGrade === 3.5 ? '#007aff' : '';
        document.getElementById('startGrade35').style.color = this.startingGrade === 3.5 ? 'white' : '';
    }

    addStudent() {
        if (!this.currentClassId) {
            alert('Bitte wählen Sie zuerst eine Klasse aus.');
            return;
        }

        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const photoFile = document.getElementById('studentPhoto').files[0];

        if (!firstName || !lastName) return;

        if (this.currentEditingStudent) {
            // Edit existing student
            const student = this.currentEditingStudent;
            student.firstName = firstName;
            student.lastName = lastName;

            if (photoFile) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    student.photo = e.target.result;
                    this.updateStudentEverywhere(student);
                    this.saveCurrentClassState();
                };
                reader.readAsDataURL(photoFile);
            } else {
                this.updateStudentEverywhere(student);
                this.saveCurrentClassState();
            }
        } else {
            // Add new student
            const student = {
                id: Date.now() + Math.random(),
                firstName,
                lastName,
                photo: null
            };

            if (photoFile) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    student.photo = e.target.result;
                    this.students.push(student);
                    this.renderStudentPool();
                    this.saveCurrentClassState();
                };
                reader.readAsDataURL(photoFile);
            } else {
                this.students.push(student);
                this.renderStudentPool();
                this.saveCurrentClassState();
            }
        }

        document.getElementById('studentModal').style.display = 'none';
        this.clearForm();
    }

    clearForm() {
        document.getElementById('studentForm').reset();
        this.currentEditingStudent = null;
        document.getElementById('deleteStudent').style.display = 'none';
        document.getElementById('submitButton').textContent = 'Hinzufügen';
        document.querySelector('.modal-content h3').textContent = 'Neuen Schüler hinzufügen';
    }

    renderStudentPool() {
        const pool = document.getElementById('studentPool');
        pool.innerHTML = '';

        // Get unassigned students and sort them alphabetically
        const unassignedStudents = this.students.filter(student => {
            return !this.desks.some(desk => desk.students.some(s => s.id === student.id));
        });

        // Sort alphabetically by first name, then last name
        unassignedStudents.sort((a, b) => {
            const firstNameCompare = a.firstName.localeCompare(b.firstName, 'de');
            if (firstNameCompare !== 0) return firstNameCompare;
            return a.lastName.localeCompare(b.lastName, 'de');
        });

        unassignedStudents.forEach(student => {
            const card = this.createStudentCard(student);
            pool.appendChild(card);
        });
    }

    createStudentCard(student) {
        const card = document.createElement('div');
        card.className = 'student-card';
        
        // Add lateness visual indicator
        const latenessLevel = this.getCurrentLatenessLevel(student.id);
        if (latenessLevel > 0) {
            // Apply lateness background color class
            card.className += ` lateness-${latenessLevel}`;
            
            // Add minutes indicator text
            const latenessIndicator = document.createElement('div');
            latenessIndicator.className = 'student-lateness-indicator';
            latenessIndicator.textContent = `${latenessLevel}min`;
            card.appendChild(latenessIndicator);
        }
        
        card.draggable = true;
        card.dataset.studentId = student.id;

        const avatar = document.createElement('div');
        avatar.className = 'student-avatar';
        avatar.draggable = true; // Make avatar draggable

        if (student.photo) {
            const img = document.createElement('img');
            img.src = student.photo;
            img.draggable = true; // Make image draggable
            avatar.appendChild(img);
        } else {
            const initials = student.firstName.charAt(0) + student.lastName.charAt(0);
            avatar.textContent = initials.toUpperCase();
        }

        const name = document.createElement('div');
        name.className = 'student-name';
        name.textContent = student.firstName;

        // Add counter display
        const counter = document.createElement('div');
        counter.className = 'student-counter';

        if (this.showGrades) {
            const grade = this.calculateGrade(student.id);
            counter.textContent = grade;
            counter.classList.add('grade-display');

            // Add grade-specific color class
            const gradeValue = parseFloat(grade);
            counter.classList.remove('grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6');

            if (gradeValue >= 1.0 && gradeValue <= 1.5) {
                counter.classList.add('grade-1');
            } else if (gradeValue > 1.5 && gradeValue <= 2.5) {
                counter.classList.add('grade-2');
            } else if (gradeValue > 2.5 && gradeValue <= 3.5) {
                counter.classList.add('grade-3');
            } else if (gradeValue > 3.5 && gradeValue <= 4.5) {
                counter.classList.add('grade-4');
            } else if (gradeValue > 4.5 && gradeValue <= 5.5) {
                counter.classList.add('grade-5');
            } else {
                counter.classList.add('grade-6');
            }
        } else {
            counter.textContent = this.studentCounters.get(student.id) || 0;
            counter.classList.remove('grade-display', 'grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6');
        }

        // Check if student is seated (define before using)
        const isSeated = this.desks.some(desk => desk.students.some(s => s.id === student.id));

        // Add edit button
        const actions = document.createElement('div');
        actions.className = 'student-card-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit';
        editBtn.innerHTML = '✏';
        editBtn.title = 'Bearbeiten';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editStudent(student);
        });

        actions.appendChild(editBtn);

        // Add lateness button for seated students
        if (isSeated) {
            const latenessBtn = document.createElement('button');
            latenessBtn.className = 'btn-edit';
            latenessBtn.innerHTML = '🕐';
            latenessBtn.title = 'Verspätet';
            latenessBtn.style.background = '#ff9500';
            latenessBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showLatenessModal(student.id);
            });
            actions.appendChild(latenessBtn);
        }

        // Add move to pool button for seated students
        if (isSeated) {
            const moveBtn = document.createElement('button');
            moveBtn.className = 'btn-edit';
            moveBtn.innerHTML = '↩';
            moveBtn.title = 'Zur Schülerliste';
            moveBtn.style.background = '#34c759';
            moveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.moveStudentToPool(student.id);
            });
            actions.appendChild(moveBtn);

        }
        card.appendChild(actions);
        card.appendChild(avatar);
        card.appendChild(name);
        card.appendChild(counter);

        // Add drag events for all students (both in pool and seated)
        card.addEventListener('dragstart', this.handleDragStart.bind(this));
        card.addEventListener('dragend', this.handleDragEnd.bind(this));

        // Make sure drag events work on all child elements
        avatar.addEventListener('dragstart', this.handleDragStart.bind(this));
        avatar.addEventListener('dragend', this.handleDragEnd.bind(this));
        name.addEventListener('dragstart', this.handleDragStart.bind(this));
        name.addEventListener('dragend', this.handleDragEnd.bind(this));
        counter.addEventListener('dragstart', this.handleDragStart.bind(this));
        counter.addEventListener('dragend', this.handleDragEnd.bind(this));

        // Add counter events (only for seated students)
        if (isSeated) {
            let touchStarted = false;
            let mouseStarted = false;
            let touchStartPosition = null;
            let mouseStartPosition = null;

            // Touch events for mobile devices
            card.addEventListener('touchstart', (e) => {
                if (e.target.closest('.student-card-actions')) return;

                // Prevent context menu on touch devices
                e.preventDefault();
                touchStarted = true;
                mouseStarted = false;
                this.isDragging = false; // Reset drag state
                touchStartPosition = { 
                    x: e.touches[0].clientX, 
                    y: e.touches[0].clientY 
                };

                // Start counter press immediately
                this.handleCounterPress(student.id);
            });

            card.addEventListener('touchmove', (e) => {
                if (!touchStarted || !touchStartPosition) return;

                const currentPos = { 
                    x: e.touches[0].clientX, 
                    y: e.touches[0].clientY 
                };
                const distance = Math.sqrt(
                    Math.pow(currentPos.x - touchStartPosition.x, 2) + 
                    Math.pow(currentPos.y - touchStartPosition.y, 2)
                );

                // If moved more than 10 pixels, consider it a drag (increased threshold)
                if (distance > 10) {
                    if (!this.isDragging) {
                        this.isDragging = true;
                        this.handleCounterRelease(student.id);
                    }
                }
            });

            card.addEventListener('touchend', (e) => {
                if (e.target.closest('.student-card-actions')) return;
                if (!touchStarted) return;

                touchStarted = false;

                // Add a small delay to ensure touch end is processed properly
                setTimeout(() => {
                    // Only handle counter release if not dragging
                    if (!this.isDragging) {
                        this.handleCounterRelease(student.id);
                    }
                    touchStartPosition = null;
                }, 50);
            });

            card.addEventListener('touchcancel', (e) => {
                if (!touchStarted) return;
                touchStarted = false;
                
                setTimeout(() => {
                    this.handleCounterRelease(student.id);
                    touchStartPosition = null;
                }, 50);
            });

            // Mouse events for desktop (only if no touch was started)
            card.addEventListener('mousedown', (e) => {
                if (e.target.closest('.student-card-actions')) return;
                if (touchStarted) return; // Skip if touch is active

                // Prevent context menu for right clicks during counter operations
                if (e.button === 2) {
                    e.preventDefault();
                    e.stopPropagation();
                }

                mouseStarted = true;
                this.isDragging = false; // Reset drag state
                mouseStartPosition = { x: e.clientX, y: e.clientY };

                // Start counter press immediately
                this.handleCounterPress(student.id);
            });

            // Prevent context menu completely on seated students
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            });

            card.addEventListener('mousemove', (e) => {
                if (!mouseStarted || !mouseStartPosition || touchStarted) return;

                const distance = Math.sqrt(
                    Math.pow(e.clientX - mouseStartPosition.x, 2) + 
                    Math.pow(e.clientY - mouseStartPosition.y, 2)
                );

                // If moved more than 5 pixels, consider it a drag
                if (distance > 5) {
                    if (!this.isDragging) {
                        this.isDragging = true;
                        this.handleCounterRelease(student.id);
                    }
                }
            });

            card.addEventListener('mouseup', (e) => {
                if (e.target.closest('.student-card-actions')) return;
                if (!mouseStarted || touchStarted) return;

                mouseStarted = false;

                // Only handle counter release if not dragging
                if (!this.isDragging) {
                    this.handleCounterRelease(student.id);
                }

                mouseStartPosition = null;
            });

            card.addEventListener('mouseleave', (e) => {
                if (!mouseStarted || touchStarted) return;

                mouseStarted = false;
                this.handleCounterRelease(student.id);
                mouseStartPosition = null;
            });
        }
        // Note: Pool students don't need double-click handlers since they're already in the pool

        return card;
    }

    handleDragStart(e) {
        // Find the student card element (could be the card itself or a child)
        const studentCard = e.target.closest('.student-card');
        if (studentCard) {
            this.draggedElement = studentCard;
            studentCard.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            this.isDragging = true;
            this.dragStartPosition = { x: e.clientX, y: e.clientY };
        }
    }

    handleDragEnd(e) {
        // Find the student card element (could be the card itself or a child)
        const studentCard = e.target.closest('.student-card');
        if (studentCard) {
            studentCard.classList.remove('dragging');
        }
        this.draggedElement = null;

        // Reset drag state after a small delay to ensure all events are processed
        setTimeout(() => {
            this.isDragging = false;
            this.dragStartPosition = null;
        }, 50);
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const deskElement = e.target.closest('.desk');
        if (deskElement) {
            deskElement.classList.add('drag-over');
        }
    }

    handleDragLeave(e) {
        const deskElement = e.target.closest('.desk');
        if (deskElement) {
            deskElement.classList.remove('drag-over');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        const deskElement = e.target.closest('.desk');
        if (deskElement) {
            deskElement.classList.remove('drag-over');

            if (!this.draggedElement) return;

            const studentId = this.draggedElement.dataset.studentId;
            const deskId = parseInt(deskElement.dataset.deskId);
            
            // Calculate drop position for double desks
            let dropPosition = 'center';
            const desk = this.desks.find(d => d.id === deskId);
            if (desk && desk.type === 'double') {
                const rect = deskElement.getBoundingClientRect();
                const dropX = e.clientX - rect.left;
                const deskWidth = rect.width;
                
                // Determine if dropped on left or right half
                if (dropX < deskWidth / 2) {
                    dropPosition = 'left';
                } else {
                    dropPosition = 'right';
                }
            }

            this.assignStudentToDesk(studentId, deskId, dropPosition);
        }
    }

    assignStudentToDesk(studentId, deskId, dropPosition = 'center') {
        const student = this.students.find(s => s.id == studentId);
        const targetDesk = this.desks.find(d => d.id === deskId);

        if (!student || !targetDesk) {
            return;
        }

        // Check if desk is full
        if (targetDesk.students.length >= targetDesk.capacity) {
            // If desk is full, don't allow assignment
            return;
        }

        // Find current desk of the dragged student
        const currentDesk = this.desks.find(d => d.students.some(s => s.id == studentId));

        // Remove student from current desk if they have one
        if (currentDesk) {
            const studentIndex = currentDesk.students.findIndex(s => s.id == studentId);
            if (studentIndex > -1) {
                currentDesk.students.splice(studentIndex, 1);
                this.updateDeskContent(currentDesk, currentDesk.element);
            }
        }

        // Store drop position for double desks
        if (targetDesk.type === 'double') {
            // Check if there's already a student on the desk
            if (targetDesk.students.length > 0) {
                const existingStudent = targetDesk.students[0];
                
                // If the existing student has a defined position, place new student on opposite side
                // NEVER change the existing student's position if it's already set
                if (existingStudent.deskPosition === 'left') {
                    student.deskPosition = 'right';
                } else if (existingStudent.deskPosition === 'right') {
                    student.deskPosition = 'left';
                } else {
                    // If existing student has no position, assign based on drop position
                    // The existing student keeps their current position, new student takes the other
                    if (dropPosition === 'left') {
                        student.deskPosition = 'left';
                        existingStudent.deskPosition = 'right';
                    } else if (dropPosition === 'right') {
                        student.deskPosition = 'right';
                        existingStudent.deskPosition = 'left';
                    } else {
                        // Default assignment when drop position is center or invalid
                        // Give precedence to the drop position if available
                        student.deskPosition = 'left';
                        existingStudent.deskPosition = 'right';
                    }
                }
            } else {
                // No existing student, assign the drop position (default to left for center)
                if (dropPosition === 'left' || dropPosition === 'right') {
                    student.deskPosition = dropPosition;
                } else {
                    student.deskPosition = 'left'; // Default to left for center drops
                }
            }
        } else {
            delete student.deskPosition;
        }

        // Add student to target desk
        targetDesk.students.push(student);
        this.updateDeskContent(targetDesk, targetDesk.element);

        // Update student pool
        this.renderStudentPool();

        // Save state
        this.saveCurrentClassState();
    }

    removeStudentFromDesk(studentId) {
        const desk = this.desks.find(d => d.students.some(s => s.id === studentId));
        if (desk) {
            const studentIndex = desk.students.findIndex(s => s.id === studentId);
            if (studentIndex > -1) {
                desk.students.splice(studentIndex, 1);
                this.updateDeskContent(desk, desk.element);
            }
        }
        this.renderStudentPool();
    }

    resetAllDesks() {
        this.desks.forEach(desk => {
            desk.students = [];
            this.updateDeskContent(desk, desk.element);
        });
        this.studentCounters.clear(); // Clear counters as well
        this.renderStudentPool();
        this.saveCurrentClassState();
    }

    resetAllLateness() {
        this.latenessTable.clear(); // Clear all lateness data
        this.renderDesks(); // Update desk display to remove lateness indicators
        this.renderStudentPool(); // Update student pool to remove lateness indicators
        this.saveCurrentClassState(); // Save the changes
    }

    resetAllCounters() {
        if (confirm('Möchten Sie wirklich alle Zähler in dieser Klasse zurücksetzen?')) {
            this.studentCounters.clear();
            this.updateAllCounterDisplays();
            
            // Re-render all desk contents to show reset counters
            this.desks.forEach(desk => {
                this.updateDeskContent(desk, desk.element);
            });
            
            this.renderStudentPool();
            this.saveCurrentClassState();
        }
    }

    addRow() {
        // Save current seat assignments
        const currentAssignments = this.getDeskAssignments();

        this.gridRows++;
        this.createSeats();

        // Restore assignments that still fit
        this.loadDeskAssignments(currentAssignments);

        this.renderStudentPool();
        this.saveCurrentClassState();
    }

    removeRow() {
        if (this.gridRows <= 1) return;

        // Save current seat assignments
        const currentAssignments = this.getDeskAssignments();

        // Calculate which seats will be removed
        const newTotalSeats = (this.gridRows - 1) * this.gridColumns;
        const removedStudents = [];

        // Find students that will be affected
        currentAssignments.forEach((studentId, seatIndex) => {
            if (seatIndex >= newTotalSeats) {
                const student = this.students.find(s => s.id === studentId);
                if (student) {
                    removedStudents.push(student.firstName + ' ' + student.lastName);
                }
            }
        });

        // Show confirmation if students will be moved
        if (removedStudents.length > 0) {
            const message = `Die folgenden Schüler werden zurück in die Schülerliste verschoben:\n\n${removedStudents.join('\n')}\n\nMöchten Sie fortfahren?`;
            if (!confirm(message)) {
                return;
            }
        }

        this.gridRows--;
        this.createSeats();

        // Restore assignments that still fit
        const filteredAssignments = new Map();
        currentAssignments.forEach((studentId, seatIndex) => {
            if (seatIndex < newTotalSeats) {
                filteredAssignments.set(seatIndex, studentId);
            }
        });

        this.loadDeskAssignments(filteredAssignments);
        this.renderStudentPool();
        this.saveCurrentClassState();
    }

    addColumn() {
        // Save current seat assignments
        const currentAssignments = this.getSeatAssignments();

        // Calculate new seat positions (seats shift when columns are added)
        const newAssignments = new Map();

        currentAssignments.forEach((studentId, oldSeatIndex) => {
            const oldRow = Math.floor(oldSeatIndex / this.gridColumns);
            const oldCol = oldSeatIndex % this.gridColumns;
            const newSeatIndex = oldRow * (this.gridColumns + 1) + oldCol;
            newAssignments.set(newSeatIndex, studentId);
        });

        this.gridColumns++;
        this.createSeats();

        // Restore assignments with new positions
        this.loadSeatAssignments(newAssignments);

        this.renderStudentPool();
        this.saveCurrentClassState();
    }

    removeColumn() {
        if (this.gridColumns <= 1) return;

        // Save current seat assignments
        const currentAssignments = this.getDeskAssignments();

        // Find students that will be affected (those in the last column)
        const removedStudents = [];
        const newAssignments = new Map();

        currentAssignments.forEach((studentId, oldSeatIndex) => {
            const oldRow = Math.floor(oldSeatIndex / this.gridColumns);
            const oldCol = oldSeatIndex % this.gridColumns;

            if (oldCol === this.gridColumns - 1) {
                // Student is in the last column, will be removed
                const student = this.students.find(s => s.id === studentId);
                if (student) {
                    removedStudents.push(student.firstName + ' ' + student.lastName);
                }
            } else {
                // Student can stay, calculate new position
                const newSeatIndex = oldRow * (this.gridColumns - 1) + oldCol;
                newAssignments.set(newSeatIndex, studentId);
            }
        });

        // Show confirmation if students will be moved
        if (removedStudents.length > 0) {
            const message = `Die folgenden Schüler werden zurück in die Schülerliste verschoben:\n\n${removedStudents.join('\n')}\n\nMöchten Sie fortfahren?`;
            if (!confirm(message)) {
                return;
            }
        }

        this.gridColumns--;
        this.createSeats();

        // Restore assignments that still fit
        this.loadDeskAssignments(newAssignments);

        this.renderStudentPool();
        this.saveCurrentClassState();
    }

    hasSeatedStudents() {
        return this.desks.some(desk => desk.students.length > 0);
    }

    editStudent(student) {
        this.currentEditingStudent = student;

        // Fill form with student data
        document.getElementById('firstName').value = student.firstName;
        document.getElementById('lastName').value = student.lastName;

        // Update modal for edit mode
        document.getElementById('deleteStudent').style.display = 'inline-block';
        document.getElementById('submitButton').textContent = 'Aktualisieren';
        document.querySelector('.modal-content h3').textContent = 'Schüler bearbeiten';

        // Show modal
        document.getElementById('studentModal').style.display = 'block';
    }

    deleteCurrentStudent() {
        if (!this.currentEditingStudent) return;

        // Remove student completely
        this.deleteStudentCompletely(this.currentEditingStudent.id);

        // Close modal and refresh
        document.getElementById('studentModal').style.display = 'none';
        this.clearForm();
        this.renderStudentPool();
    }

    moveStudentToPool(studentId) {
        // Clear deskPosition when moving to pool
        const student = this.students.find(s => s.id === studentId);
        if (student) {
            delete student.deskPosition;
        }
        
        // Only remove from desk, keep in students array
        this.removeStudentFromDesk(studentId);
        this.renderStudentPool();
        this.saveCurrentClassState();
    }

    deleteStudentCompletely(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (!student) return;

        if (confirm(`Möchten Sie ${student.firstName} ${student.lastName} wirklich komplett löschen?`)) {
            // Remove from any desk
            this.removeStudentFromDesk(studentId);

            // Remove from students array
            this.students = this.students.filter(s => s.id !== studentId);

            // Clear counter for this student
            this.studentCounters.delete(studentId);

            // Refresh displays
            this.renderStudentPool();
            this.saveCurrentClassState();
        }
    }

    updateStudentEverywhere(student) {
        // Update in desks if assigned
        const assignedDesk = this.desks.find(desk => desk.students.some(s => s.id === student.id));
        if (assignedDesk) {
            // Update the student object in the desk's students array
            const studentIndex = assignedDesk.students.findIndex(s => s.id === student.id);
            if (studentIndex > -1) {
                assignedDesk.students[studentIndex] = student;
                this.updateDeskContent(assignedDesk, assignedDesk.element);
            }
        }

        // Update student pool
        this.renderStudentPool();
    }

    handleCounterPress(studentId) {
        // Clear any existing timer first
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        // Reset state
        this.isLongPress = false;
        this.counterStartTime = Date.now();

        // Set timer for long press with longer delay for touch devices
        this.longPressTimer = setTimeout(() => {
            // Check again if we're still not dragging
            if (!this.isDragging && this.counterStartTime) {
                this.isLongPress = true;
                this.decrementCounter(studentId);
            }
        }, this.longPressDelay);
    }

    handleCounterRelease(studentId) {
        // Only process if there was actually a press started
        if (!this.counterStartTime) {
            return;
        }

        const pressDuration = Date.now() - this.counterStartTime;

        // Clear the timer
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        // If it wasn't a long press and we're not dragging, it's a short click - increment
        if (!this.isLongPress && !this.isDragging) {
            // More lenient timing for touch devices - count as click if shorter than long press delay
            if (pressDuration < this.longPressDelay) {
                this.incrementCounter(studentId);
            }
        }

        // Reset state
        this.isLongPress = false;
        this.counterStartTime = null;
    }

    incrementCounter(studentId) {
        const currentCount = this.studentCounters.get(studentId) || 0;
        this.studentCounters.set(studentId, currentCount + 1);
        this.updateCounterDisplay(studentId);
        this.saveCurrentClassState();
    }

    decrementCounter(studentId) {
        const currentCount = this.studentCounters.get(studentId) || 0;
        const newCount = currentCount - 1;
        this.studentCounters.set(studentId, newCount);
        this.updateCounterDisplay(studentId);
        this.saveCurrentClassState();
    }

    updateCounterDisplay(studentId) {
        // Find the desk that contains this student
        const desk = this.desks.find(d => d.students && d.students.some(s => s.id == studentId));
        if (desk && desk.element) {
            // Find the specific student card within the desk
            const studentCards = desk.element.querySelectorAll('.student-card');
            let counterElement = null;
            
            for (const card of studentCards) {
                if (card.dataset.studentId == studentId) {
                    counterElement = card.querySelector('.student-counter');
                    break;
                }
            }
            
            if (counterElement) {
                if (this.showGrades) {
                    const grade = this.calculateGrade(studentId);
                    counterElement.textContent = grade;
                    counterElement.classList.add('grade-display');

                    // Add grade-specific color class
                    const gradeValue = parseFloat(grade);
                    counterElement.classList.remove('grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6');

                    if (gradeValue >= 1.0 && gradeValue <= 1.5) {
                        counterElement.classList.add('grade-1');
                    } else if (gradeValue > 1.5 && gradeValue <= 2.5) {
                        counterElement.classList.add('grade-2');
                    } else if (gradeValue > 2.5 && gradeValue <= 3.5) {
                        counterElement.classList.add('grade-3');
                    } else if (gradeValue > 3.5 && gradeValue <= 4.5) {
                        counterElement.classList.add('grade-4');
                    } else if (gradeValue > 4.5 && gradeValue <= 5.5) {
                        counterElement.classList.add('grade-5');
                    } else {
                        counterElement.classList.add('grade-6');
                    }
                } else {
                    const count = this.studentCounters.get(studentId) || 0;
                    counterElement.textContent = count;
                    counterElement.classList.remove('grade-display', 'grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6');
                }
            }
        }
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const toggleBtn = document.getElementById('toggleSidebar');

        if (sidebar.style.display === 'none') {
            sidebar.style.display = 'block';
            toggleBtn.title = 'Schülerliste ausblenden';
        } else {
            sidebar.style.display = 'none';
            toggleBtn.title = 'Schülerliste einblenden';
        }
    }

    toggleHeader() {
        const header = document.querySelector('.header');
        const toggleBtn = document.getElementById('toggleHeader');

        if (header.style.display === 'none') {
            header.style.display = 'flex';
            toggleBtn.title = 'Header ausblenden';
            toggleBtn.textContent = '⬆️';
            this.removeFloatingHeaderButton();
        } else {
            header.style.display = 'none';
            toggleBtn.title = 'Header einblenden';
            toggleBtn.textContent = '⬇️';
            this.createFloatingHeaderButton();
        }
    }

    createFloatingHeaderButton() {
        // Remove any existing floating button
        this.removeFloatingHeaderButton();

        const floatingBtn = document.createElement('button');
        floatingBtn.className = 'floating-header-toggle';
        floatingBtn.id = 'floatingHeaderToggle';
        floatingBtn.textContent = '⬇️';
        floatingBtn.title = 'Header einblenden';
        floatingBtn.addEventListener('click', () => {
            this.toggleHeader();
        });

        document.body.appendChild(floatingBtn);
    }

    removeFloatingHeaderButton() {
        const existingBtn = document.getElementById('floatingHeaderToggle');
        if (existingBtn) {
            existingBtn.remove();
        }
    }

    toggleGradeDisplay() {
        this.showGrades = !this.showGrades;
        this.updateGradeDisplay();

        // Update all displays
        this.renderStudentPool();
        this.updateAllCounterDisplays();
        
        // Re-render all desk contents to show grades/counters
        this.desks.forEach(desk => {
            this.updateDeskContent(desk, desk.element);
        });
        
        this.saveCurrentClassState();
    }

    setStartingGrade(grade) {
        this.startingGrade = grade;
        this.updateStartingGradeButtons();

        // Update all displays if grades are shown
        if (this.showGrades) {
            this.renderStudentPool();
            this.updateAllCounterDisplays();
        }
        this.saveCurrentClassState();
    }

    calculateGrade(studentId) {
        const counter = this.studentCounters.get(studentId) || 0;
        const grade = this.startingGrade - (counter * 0.5);

        // Ensure grade stays within reasonable bounds (1.0 to 6.0)
        const clampedGrade = Math.max(1.0, Math.min(6.0, grade));

        // Format grade to one decimal place
        return clampedGrade.toFixed(1);
    }

    updateAllCounterDisplays() {
        this.desks.forEach(desk => {
            if (desk.students) {
                desk.students.forEach(student => {
                    this.updateCounterDisplay(student.id);
                });
            }
        });
    }

    exportData() {
        try {
            console.log('Export gestartet...');
            
            // Save current class state before exporting
            if (this.currentClassId) {
                this.saveCurrentClassState();
            }

            // Prepare export data
            const exportData = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                classes: []
            };

            console.log('Anzahl Klassen zu exportieren:', this.classes.size);

            // Convert classes Map to exportable format
            this.classes.forEach((classData, id) => {
                // Sanitize desk data for export (remove DOM references)
                const sanitizedDesks = (classData.desks || []).map(desk => ({
                    id: desk.id,
                    type: desk.type,
                    x: desk.x,
                    y: desk.y,
                    capacity: desk.capacity,
                    students: desk.students || []
                    // element property is excluded - it's runtime only
                }));

                const exportClass = {
                    id: id,
                    name: classData.name,
                    students: classData.students || [],
                    studentCounters: Array.from((classData.studentCounters || new Map()).entries()),
                    desks: sanitizedDesks,
                    deskAssignments: Array.from((classData.deskAssignments || new Map()).entries()),
                    gridRows: classData.gridRows || 5,
                    gridColumns: classData.gridColumns || 6,
                    showGrades: classData.showGrades || false,
                    startingGrade: classData.startingGrade || 4.0,
                    gradeTable: classData.gradeTable || [],
                    absenceTable: classData.absenceTable || [],
                    hiddenGrades: classData.hiddenGrades || []
                };
                exportData.classes.push(exportClass);
            });

            console.log('Export Daten vorbereitet:', exportData);

            // Create and download file
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `sitzplan_export_${new Date().toISOString().split('T')[0]}.json`;
            
            console.log('Download-Link erstellt:', link.download);
            
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            console.log('Export erfolgreich!');
            alert('Daten erfolgreich exportiert!');
            
        } catch (error) {
            console.error('Export Fehler:', error);
            alert('Fehler beim Export: ' + error.message);
        }
    }

    importData(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importData = JSON.parse(e.target.result);

                // Validate import data
                if (!importData.version || !importData.classes) {
                    throw new Error('Ungültiges Dateiformat');
                }

                // Confirm import
                const confirmMessage = `Möchten Sie die Daten importieren?\n\n` +
                    `Anzahl Klassen: ${importData.classes.length}\n` +
                    `Exportiert am: ${importData.timestamp ? new Date(importData.timestamp).toLocaleString('de-DE') : 'Unbekannt'}\n\n` +
                    `Achtung: Alle aktuellen Daten werden überschrieben!`;

                if (!confirm(confirmMessage)) {
                    document.getElementById('importFile').value = '';
                    return;
                }

                // Clear current data
                this.classes.clear();
                this.currentClassId = null;

                // Import classes
                importData.classes.forEach(classData => {
                    const importedClass = {
                        id: classData.id,
                        name: classData.name,
                        students: classData.students || [],
                        studentCounters: new Map(classData.studentCounters || []),
                        seatAssignments: new Map(classData.seatAssignments || []),
                        desks: classData.desks || [],
                        deskAssignments: new Map(classData.deskAssignments || []),
                        gridRows: classData.gridRows || 5,
                        gridColumns: classData.gridColumns || 6,
                        showGrades: classData.showGrades || false,
                        startingGrade: classData.startingGrade || 4.0,
                        gradeTable: classData.gradeTable || [],
                        absenceTable: classData.absenceTable || [],
                        hiddenGrades: classData.hiddenGrades || []
                    };
                    this.classes.set(classData.id, importedClass);
                });

                // If no classes were imported, create a default one
                if (this.classes.size === 0) {
                    this.createDefaultClass();
                } else {
                    // Switch to first imported class
                    const firstClassId = this.classes.keys().next().value;
                    this.switchClass(firstClassId);
                }

                // Rebuild desk DOM elements after import
                this.createClassroom();

                // Update UI
                this.updateClassSelect();
                this.saveClasses();

                alert(`Import erfolgreich! ${importData.classes.length} Klasse(n) wurden importiert.`);

                // Clear file input
                document.getElementById('importFile').value = '';

            } catch (error) {
                console.error('Import error:', error);
                alert('Fehler beim Importieren der Datei: ' + error.message);
                document.getElementById('importFile').value = '';
            }
        };

        reader.readAsText(file);
    }

    async importImages(files) {
        // Check if a class is selected
        if (!this.currentClassId) {
            alert('Bitte wählen Sie zuerst eine Klasse aus.');
            return;
        }

        const validFiles = [];
        const invalidFiles = [];

        // Validate filenames
        for (let file of files) {
            if (!file.type.startsWith('image/')) {
                invalidFiles.push(`${file.name} (kein Bild)`);
                continue;
            }

            const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
            const namePattern = /^(.+)-(.+)$/; // nachname-vorname pattern
            
            if (namePattern.test(fileName)) {
                const [, lastName, firstName] = fileName.match(namePattern);
                // Capitalize first letter of first and last name
                const capitalizedFirstName = firstName.trim().charAt(0).toUpperCase() + firstName.trim().slice(1).toLowerCase();
                const capitalizedLastName = lastName.trim().charAt(0).toUpperCase() + lastName.trim().slice(1).toLowerCase();
                validFiles.push({
                    file: file,
                    firstName: capitalizedFirstName,
                    lastName: capitalizedLastName
                });
            } else {
                invalidFiles.push(`${file.name} (falsches Format)`);
            }
        }

        // Show validation results
        if (invalidFiles.length > 0) {
            let message = 'Folgende Dateien haben das falsche Format und werden übersprungen:\n\n';
            message += invalidFiles.join('\n');
            message += '\n\nErwartetes Format: "nachname-vorname.jpg"';
            alert(message);
        }

        if (validFiles.length === 0) {
            alert('Keine gültigen Bilder gefunden. Verwenden Sie das Format "nachname-vorname.jpg"');
            return;
        }

        // Convert images and create students
        let successCount = 0;
        for (let validFile of validFiles) {
            try {
                const imageData = await this.fileToBase64(validFile.file);
                
                // Create new student
                const studentId = Date.now() + Math.random();
                const newStudent = {
                    id: studentId,
                    firstName: validFile.firstName,
                    lastName: validFile.lastName,
                    photo: imageData,
                    grade: this.startingGrade
                };

                this.students.push(newStudent);
                this.studentCounters.set(studentId, 0);
                successCount++;
            } catch (error) {
                console.error('Error processing file:', validFile.file.name, error);
                invalidFiles.push(`${validFile.file.name} (Fehler beim Verarbeiten)`);
            }
        }

        // Update UI and save
        this.updateUI();
        this.saveCurrentClassState();

        // Show success message
        let message = `${successCount} Schüler erfolgreich importiert!`;
        if (invalidFiles.length > 0) {
            message += `\n\n${invalidFiles.length} Dateien konnten nicht verarbeitet werden.`;
        }
        alert(message);

        // Close dropdown
        document.getElementById('dropdownContent').classList.remove('show');

        // Clear file input
        document.getElementById('importImages').value = '';
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    addDateColumnToGradeTable() {
        if (!this.currentClassId || !this.showGrades) {
            alert('Bitte aktivieren Sie zuerst die Noten-Ansicht.');
            return;
        }

        // Prompt for date column name (default: today's date)
        const today = new Date().toLocaleDateString('de-DE');
        const columnName = prompt('Datum für neue Spalte:', today);
        
        if (!columnName) {
            return; // User cancelled
        }

        // Check for duplicate column names across all periods
        const allExistingColumns = [];
        this.periods.forEach(period => {
            allExistingColumns.push(...period.columns);
        });
        
        if (allExistingColumns.includes(columnName)) {
            alert(`Eine Spalte mit dem Namen "${columnName}" existiert bereits. Bitte wählen Sie einen anderen Namen.`);
            return;
        }

        // Periodenverwaltung: Entscheiden ob neue Periode oder zu bestehender hinzufügen
        let currentPeriod = null;
        
        if (this.shouldCreateNewPeriod()) {
            currentPeriod = this.createNewPeriod(columnName);
            console.log(`Neue Periode erstellt: ${currentPeriod.name} (${currentPeriod.maxColumns} Tage)`);
        } else {
            const added = this.addColumnToPeriod(columnName);
            if (added) {
                currentPeriod = this.periods.get(this.activePeriodId);
                console.log(`Spalte zu ${currentPeriod.name} hinzugefügt (${currentPeriod.columns.length}/${currentPeriod.maxColumns})`);
            } else {
                // Fallback: create new period if adding failed
                currentPeriod = this.createNewPeriod(columnName);
                console.log(`Neue Periode erstellt (Fallback): ${currentPeriod.name}`);
            }
        }

        // Initialize grade and absence tables for all students if not exists
        this.students.forEach(student => {
            if (!this.gradeTable.has(student.id)) {
                this.gradeTable.set(student.id, new Map());
            }
            if (!this.absenceTable.has(student.id)) {
                this.absenceTable.set(student.id, new Map());
            }
            
            // Check if student is assigned to a desk
            const isAssigned = this.isStudentAssignedToDesk(student.id);
            
            if (isAssigned) {
                // Add current grade from counter as initial value for new column
                const currentGrade = this.calculateGrade(student.id);
                this.gradeTable.get(student.id).set(columnName, currentGrade);
            } else {
                // Mark as absent if not assigned to desk
                this.absenceTable.get(student.id).set(columnName, true);
            }
        });

        // Save state and show table
        this.saveCurrentClassState();
        this.showExtendedGradeTable();
    }

    isStudentAssignedToDesk(studentId) {
        return this.desks.some(desk => desk.students.some(s => s.id == studentId));
    }

    setupCheckboxEventDelegation() {
        // Remove any existing event listeners to prevent duplicates
        const container = document.getElementById('gradeTableContainer');
        const existingHandler = container._checkboxHandler;
        if (existingHandler) {
            container.removeEventListener('change', existingHandler);
        }
        
        // Create new event handler for combined attendance/lateness control
        const handler = (e) => {
            if (e.target.classList.contains('attendance-select')) {
                const studentId = parseFloat(e.target.dataset.studentId);
                const dateColumn = e.target.dataset.column;
                const value = e.target.value;
                
                // Guard against invalid student ID
                if (isNaN(studentId) || !dateColumn) {
                    return;
                }
                
                // Parse the selected value
                if (value === 'absent') {
                    // Mark as absent and clear any lateness
                    this.setAbsence(studentId, dateColumn, true);
                    this.setLateness(studentId, dateColumn, 0);
                } else if (value === 'present') {
                    // Mark as present and clear lateness
                    this.setAbsence(studentId, dateColumn, false);
                    this.setLateness(studentId, dateColumn, 0);
                } else if (value.startsWith('late_')) {
                    // Mark as present but late
                    this.setAbsence(studentId, dateColumn, false);
                    const latenessLevel = parseInt(value.split('_')[1], 10);
                    this.setLateness(studentId, dateColumn, latenessLevel);
                }
            }
        };
        
        // Store reference for cleanup and add listener
        container._checkboxHandler = handler;
        container.addEventListener('change', handler);
    }

    showExtendedGradeTable() {
        if (!this.currentClassId || !this.showGrades) {
            return;
        }

        // Prevent multiple simultaneous executions
        if (this._renderingTable) {
            return;
        }
        this._renderingTable = true;

        // Get all date columns
        const dateColumns = new Set();
        this.gradeTable.forEach(studentGrades => {
            studentGrades.forEach((grade, dateColumn) => {
                dateColumns.add(dateColumn);
            });
        });

        const sortedDateColumns = Array.from(dateColumns).sort();

        // Initialize absence table for students without entries (but don't auto-mark as absent)
        this.students.forEach(student => {
            if (!this.absenceTable.has(student.id)) {
                this.absenceTable.set(student.id, new Map());
            }
            // Initialize lateness table for students without entries
            if (!this.latenessTable.has(student.id)) {
                this.latenessTable.set(student.id, new Map());
            }
        });

        // Collect all students with their grades
        const studentsWithGrades = [];

        this.students.forEach(student => {
            const studentGrades = this.gradeTable.get(student.id) || new Map();
            const studentAbsences = this.absenceTable.get(student.id) || new Map();
            const studentLateness = this.latenessTable.get(student.id) || new Map();
            
            // Calculate average based on periods, not individual days
            const average = this.calculateStudentAverage(student.id);

            studentsWithGrades.push({
                id: student.id,
                lastName: student.lastName,
                firstName: student.firstName,
                grades: studentGrades,
                absences: studentAbsences,
                lateness: studentLateness,
                average: average,
                latenessCount: this.countStudentLateness(student.id),
                absenceCount: this.countStudentAbsences(student.id)
            });
        });

        // Sort by current sort column and direction
        this.sortStudents(studentsWithGrades, sortedDateColumns);

        // Generate period-grouped headers
        const periodGroups = this.generatePeriodGroups(sortedDateColumns);
        
        // Create table HTML with period-grouped headers
        let tableHTML = `
            <table class="extended-grade-table">
                <thead>
                    <!-- First row: Period headers -->
                    <tr>
                        <th rowspan="2" onclick="window.seatingPlan.sortTable('lastName')" style="cursor: pointer;">
                            Nachname ${this.getSortIndicator('lastName')}
                        </th>
                        <th rowspan="2" onclick="window.seatingPlan.sortTable('firstName')" style="cursor: pointer;">
                            Vorname ${this.getSortIndicator('firstName')}
                        </th>
                        <th rowspan="2" onclick="window.seatingPlan.sortTable('average')" style="cursor: pointer;">
                            Durchschnitt ${this.getSortIndicator('average')}
                        </th>
                        <th rowspan="2" onclick="window.seatingPlan.sortTable('latenessCount')" style="cursor: pointer;">
                            Verspätungen ${this.getSortIndicator('latenessCount')}
                        </th>
                        <th rowspan="2" onclick="window.seatingPlan.sortTable('absenceCount')" style="cursor: pointer;">
                            Abwesenheiten ${this.getSortIndicator('absenceCount')}
                        </th>
        `;

        // Add period headers
        periodGroups.forEach(group => {
            const colSpan = group.columns.length + (group.columns.length > 1 ? 1 : 0); // +1 for period grade if multi-day
            tableHTML += `
                <th colspan="${colSpan}" class="period-header">
                    ${group.name} ${group.columns.length > 1 ? `(${group.columns.length} Tage)` : ''}
                </th>
            `;
        });

        tableHTML += `
                    </tr>
                    <!-- Second row: Date columns -->
                    <tr>
        `;

        // Add date column headers with edit/delete buttons
        periodGroups.forEach(group => {
            group.columns.forEach(dateColumn => {
                tableHTML += `
                    <th onclick="window.seatingPlan.sortTable('${dateColumn}')" style="cursor: pointer;">
                        <div class="column-header">
                            <span class="column-name" data-column="${dateColumn}" onclick="event.stopPropagation(); window.seatingPlan.editColumnName('${dateColumn}')">${dateColumn} ${this.getSortIndicator(dateColumn)}</span>
                            <button class="btn-small btn-danger" onclick="event.stopPropagation(); window.seatingPlan.deleteColumn('${dateColumn}')" title="Spalte löschen">×</button>
                        </div>
                    </th>
                `;
            });
            
            // Add period grade column for multi-day periods
            if (group.columns.length > 1) {
                tableHTML += `
                    <th class="period-grade-header">
                        Note
                    </th>
                `;
            }
        });

        tableHTML += `
                    </tr>
                </thead>
                <tbody>
        `;

        // Add student rows
        studentsWithGrades.forEach(student => {
            tableHTML += `
                <tr>
                    <td>${student.lastName}</td>
                    <td>${student.firstName}</td>
                    <td><strong>${student.average}</strong></td>
                    <td><strong>${student.latenessCount}</strong></td>
                    <td><strong>${student.absenceCount}</strong></td>
            `;

            // Add grade cells grouped by periods
            periodGroups.forEach(group => {
                // Add individual date columns for this period
                group.columns.forEach(dateColumn => {
                    const grade = student.grades.get(dateColumn) || '';
                    const isAbsent = student.absences.get(dateColumn) || false;
                    const latenessLevel = student.lateness.get(dateColumn) || 0;
                    const isLate = latenessLevel > 0;
                    const gradeValue = parseFloat(grade);
                    let gradeClass = '';
                    
                    if (!isNaN(gradeValue)) {
                        if (gradeValue >= 1.0 && gradeValue <= 1.5) gradeClass = 'grade-1';
                        else if (gradeValue > 1.5 && gradeValue <= 2.5) gradeClass = 'grade-2';
                        else if (gradeValue > 2.5 && gradeValue <= 3.5) gradeClass = 'grade-3';
                        else if (gradeValue > 3.5 && gradeValue <= 4.5) gradeClass = 'grade-4';
                        else if (gradeValue > 4.5 && gradeValue <= 5.5) gradeClass = 'grade-5';
                        else gradeClass = 'grade-6';
                    }

                    // Determine combined attendance/lateness status
                    let attendanceStatus = 'present';
                    if (isAbsent) {
                        attendanceStatus = 'absent';
                    } else if (latenessLevel > 0) {
                        attendanceStatus = `late_${latenessLevel}`;
                    }

                    tableHTML += `
                        <td>
                            <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                                <select class="attendance-select"
                                        data-student-id="${student.id}" 
                                        data-column="${dateColumn}"
                                        title="Anwesenheit/Verspätung">
                                    <option value="present" ${attendanceStatus === 'present' ? 'selected' : ''}>—</option>
                                    <option value="absent" ${attendanceStatus === 'absent' ? 'selected' : ''}>🚫 Abw</option>
                                    <option value="late_5" ${attendanceStatus === 'late_5' ? 'selected' : ''}>🕐 5min</option>
                                    <option value="late_10" ${attendanceStatus === 'late_10' ? 'selected' : ''}>🕐 10min</option>
                                    <option value="late_15" ${attendanceStatus === 'late_15' ? 'selected' : ''}>🕐 15min</option>
                                    <option value="late_20" ${attendanceStatus === 'late_20' ? 'selected' : ''}>🕐 20min</option>
                                    <option value="late_25" ${attendanceStatus === 'late_25' ? 'selected' : ''}>🕐 25min</option>
                                    <option value="late_30" ${attendanceStatus === 'late_30' ? 'selected' : ''}>🕐 30min</option>
                                    <option value="late_35" ${attendanceStatus === 'late_35' ? 'selected' : ''}>🕐 35min</option>
                                    <option value="late_40" ${attendanceStatus === 'late_40' ? 'selected' : ''}>🕐 40min</option>
                                    <option value="late_45" ${attendanceStatus === 'late_45' ? 'selected' : ''}>🕐 45min</option>
                                </select>
                                <input type="text" class="grade-input ${gradeClass}${isAbsent ? ' absent' : ''}${isLate ? ' late' : ''}" 
                                       value="${isAbsent ? '' : (grade ? grade.toString().replace('.', ',') : '')}" 
                                       data-student-id="${student.id}" 
                                       data-column="${dateColumn}"
                                       ${isAbsent ? 'disabled' : ''}
                                       onchange="window.seatingPlan.updateGrade(this)"
                                       onblur="window.seatingPlan.updateGrade(this)"
                                       placeholder="${isAbsent ? 'Abw' : ''}">
                            </div>
                        </td>
                    `;
                });
                
                // Add period grade column for multi-day periods
                if (group.columns.length > 1 && group.periodId) {
                    const periodGrade = this.calculatePeriodGrade(student.id, group.periodId);
                    let periodGradeClass = '';
                    
                    if (periodGrade !== null && !isNaN(periodGrade)) {
                        if (periodGrade >= 1.0 && periodGrade <= 1.5) periodGradeClass = 'grade-1';
                        else if (periodGrade > 1.5 && periodGrade <= 2.5) periodGradeClass = 'grade-2';
                        else if (periodGrade > 2.5 && periodGrade <= 3.5) periodGradeClass = 'grade-3';
                        else if (periodGrade > 3.5 && periodGrade <= 4.5) periodGradeClass = 'grade-4';
                        else if (periodGrade > 4.5 && periodGrade <= 5.5) periodGradeClass = 'grade-5';
                        else periodGradeClass = 'grade-6';
                    }
                    
                    const periodGradeDisplay = periodGrade !== null ? periodGrade.toFixed(1).replace('.', ',') : '-';
                    
                    tableHTML += `
                        <td class="period-grade-cell ${periodGradeClass}" data-student-id="${student.id}" data-period-id="${group.periodId}">
                            <strong>${periodGradeDisplay}</strong>
                        </td>
                    `;
                }
            });

            tableHTML += `</tr>`;
        });

        tableHTML += `
                </tbody>
            </table>
        `;

        // Insert table into modal and show
        document.getElementById('gradeTableContainer').innerHTML = tableHTML;
        
        // Setup event delegation for absence and lateness checkboxes
        this.setupCheckboxEventDelegation();
        
        document.getElementById('gradeTableModal').style.display = 'block';
        
        // Reset rendering flag
        this._renderingTable = false;
    }

    editColumnName(oldName) {
        const newName = prompt('Neuer Name für die Spalte:', oldName);
        if (!newName || newName === oldName) {
            return;
        }

        // Rename column in all student grade tables
        this.gradeTable.forEach(studentGrades => {
            if (studentGrades.has(oldName)) {
                const grade = studentGrades.get(oldName);
                studentGrades.delete(oldName);
                studentGrades.set(newName, grade);
            }
        });
        
        // Rename column in all student absence tables  
        this.absenceTable.forEach(studentAbsences => {
            if (studentAbsences.has(oldName)) {
                const absence = studentAbsences.get(oldName);
                studentAbsences.delete(oldName);
                studentAbsences.set(newName, absence);
            }
        });
        
        // Rename column in all student hidden grades tables
        this.hiddenGrades.forEach(studentHiddenGrades => {
            if (studentHiddenGrades.has(oldName)) {
                const hiddenGrade = studentHiddenGrades.get(oldName);
                studentHiddenGrades.delete(oldName);
                studentHiddenGrades.set(newName, hiddenGrade);
            }
        });
        
        // Update column names in periods
        this.periods.forEach(period => {
            const columnIndex = period.columns.indexOf(oldName);
            if (columnIndex !== -1) {
                period.columns[columnIndex] = newName;
            }
        });

        this.saveCurrentClassState();
        this.showExtendedGradeTable();
    }

    toggleLateness(checkbox) {
        const studentId = parseFloat(checkbox.dataset.studentId);
        const column = checkbox.dataset.column;
        const isLate = checkbox.checked;
        
        // Initialize lateness table if not exists
        if (!this.latenessTable.has(studentId)) {
            this.latenessTable.set(studentId, new Map());
        }
        
        const studentLateness = this.latenessTable.get(studentId);
        
        if (isLate) {
            // Default to 5 minutes for checkbox-based lateness
            studentLateness.set(column, 5);
        } else {
            studentLateness.delete(column);
        }
        
        this.saveCurrentClassState();
        this.showExtendedGradeTable();
    }

    setAbsence(studentId, dateColumn, isAbsent) {
        // Initialize absence table if not exists
        if (!this.absenceTable.has(studentId)) {
            this.absenceTable.set(studentId, new Map());
        }
        
        // Initialize hidden grades table if not exists
        if (!this.hiddenGrades.has(studentId)) {
            this.hiddenGrades.set(studentId, new Map());
        }
        
        const studentAbsences = this.absenceTable.get(studentId);
        const studentHiddenGrades = this.hiddenGrades.get(studentId);
        
        if (isAbsent) {
            studentAbsences.set(dateColumn, true);
            // Save existing grade before hiding it
            if (this.gradeTable.has(studentId)) {
                const studentGrades = this.gradeTable.get(studentId);
                if (studentGrades.has(dateColumn)) {
                    const existingGrade = studentGrades.get(dateColumn);
                    studentHiddenGrades.set(dateColumn, existingGrade);
                    studentGrades.delete(dateColumn);
                }
            }
        } else {
            studentAbsences.delete(dateColumn);
            // Restore hidden grade if it exists
            if (studentHiddenGrades.has(dateColumn)) {
                const hiddenGrade = studentHiddenGrades.get(dateColumn);
                if (!this.gradeTable.has(studentId)) {
                    this.gradeTable.set(studentId, new Map());
                }
                this.gradeTable.get(studentId).set(dateColumn, hiddenGrade);
                studentHiddenGrades.delete(dateColumn);
            }
        }
        
        this.saveCurrentClassState();
        this.showExtendedGradeTable();
    }

    toggleAbsence(checkbox) {
        const studentId = parseFloat(checkbox.dataset.studentId);
        const column = checkbox.dataset.column;
        const isAbsent = checkbox.checked;
        
        
        // Initialize absence table if not exists
        if (!this.absenceTable.has(studentId)) {
            this.absenceTable.set(studentId, new Map());
        }
        
        // Initialize hidden grades table if not exists
        if (!this.hiddenGrades.has(studentId)) {
            this.hiddenGrades.set(studentId, new Map());
        }
        
        const studentAbsences = this.absenceTable.get(studentId);
        const studentHiddenGrades = this.hiddenGrades.get(studentId);
        
        if (isAbsent) {
            studentAbsences.set(column, true);
            // Save existing grade before hiding it
            if (this.gradeTable.has(studentId)) {
                const studentGrades = this.gradeTable.get(studentId);
                if (studentGrades.has(column)) {
                    const existingGrade = studentGrades.get(column);
                    studentHiddenGrades.set(column, existingGrade);
                    studentGrades.delete(column);
                }
            }
        } else {
            studentAbsences.delete(column);
            // Restore hidden grade if it exists
            if (studentHiddenGrades.has(column)) {
                const hiddenGrade = studentHiddenGrades.get(column);
                if (!this.gradeTable.has(studentId)) {
                    this.gradeTable.set(studentId, new Map());
                }
                this.gradeTable.get(studentId).set(column, hiddenGrade);
                studentHiddenGrades.delete(column);
            }
        }
        
        this.saveCurrentClassState();
        this.showExtendedGradeTable();
    }

    getSortIndicator(column) {
        if (this.sortColumn !== column) {
            return ''; // No indicator if not current sort column
        }
        return this.sortDirection === 'asc' ? '▲' : '▼';
    }

    sortTable(column) {
        // If clicking on same column, toggle direction
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // New column, default to ascending
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        // Refresh the table with new sorting
        this.showExtendedGradeTable();
    }

    sortStudents(studentsWithGrades, sortedDateColumns) {
        studentsWithGrades.sort((a, b) => {
            let compareResult = 0;
            
            switch (this.sortColumn) {
                case 'lastName':
                    compareResult = a.lastName.localeCompare(b.lastName, 'de');
                    if (compareResult === 0) {
                        compareResult = a.firstName.localeCompare(b.firstName, 'de');
                    }
                    break;
                case 'firstName':
                    compareResult = a.firstName.localeCompare(b.firstName, 'de');
                    if (compareResult === 0) {
                        compareResult = a.lastName.localeCompare(b.lastName, 'de');
                    }
                    break;
                case 'average':
                    // Handle '-' for no average - put them at bottom
                    if (a.average === '-' && b.average === '-') return 0;
                    if (a.average === '-') return 1;
                    if (b.average === '-') return -1;
                    
                    const avgA = parseFloat(a.average.replace(',', '.'));
                    const avgB = parseFloat(b.average.replace(',', '.'));
                    compareResult = avgA - avgB;
                    
                    // Tiebreaker: lastName then firstName
                    if (compareResult === 0) {
                        compareResult = a.lastName.localeCompare(b.lastName, 'de');
                        if (compareResult === 0) {
                            compareResult = a.firstName.localeCompare(b.firstName, 'de');
                        }
                    }
                    break;
                case 'latenessCount':
                    compareResult = a.latenessCount - b.latenessCount;
                    
                    // Tiebreaker: lastName then firstName
                    if (compareResult === 0) {
                        compareResult = a.lastName.localeCompare(b.lastName, 'de');
                        if (compareResult === 0) {
                            compareResult = a.firstName.localeCompare(b.firstName, 'de');
                        }
                    }
                    break;
                case 'absenceCount':
                    compareResult = a.absenceCount - b.absenceCount;
                    
                    // Tiebreaker: lastName then firstName
                    if (compareResult === 0) {
                        compareResult = a.lastName.localeCompare(b.lastName, 'de');
                        if (compareResult === 0) {
                            compareResult = a.firstName.localeCompare(b.firstName, 'de');
                        }
                    }
                    break;
                default:
                    // Sort by date column (individual day)
                    if (sortedDateColumns.includes(this.sortColumn)) {
                        const gradeA = a.grades.get(this.sortColumn);
                        const gradeB = b.grades.get(this.sortColumn);
                        const isAbsentA = a.absences.get(this.sortColumn);
                        const isAbsentB = b.absences.get(this.sortColumn);
                        
                        // Absent students go to bottom
                        if (isAbsentA && !isAbsentB) return 1;
                        if (!isAbsentA && isAbsentB) return -1;
                        if (isAbsentA && isAbsentB) return 0;
                        
                        // Compare grades (empty grades go to bottom)
                        if (!gradeA && !gradeB) return 0;
                        if (!gradeA) return 1;
                        if (!gradeB) return -1;
                        
                        const numGradeA = parseFloat(gradeA.replace(',', '.'));
                        const numGradeB = parseFloat(gradeB.replace(',', '.'));
                        compareResult = numGradeA - numGradeB;
                        
                        // Tiebreaker: lastName then firstName
                        if (compareResult === 0) {
                            compareResult = a.lastName.localeCompare(b.lastName, 'de');
                            if (compareResult === 0) {
                                compareResult = a.firstName.localeCompare(b.firstName, 'de');
                            }
                        }
                    }
                    break;
            }
            
            // Apply sort direction
            if (this.sortDirection === 'desc') {
                compareResult = -compareResult;
            }
            
            return compareResult;
        });
    }

    deleteColumn(columnName) {
        if (!confirm(`Möchten Sie die Spalte "${columnName}" wirklich löschen?`)) {
            return;
        }

        // Remove column from all student grade tables
        this.gradeTable.forEach(studentGrades => {
            studentGrades.delete(columnName);
        });
        
        // Remove column from all student absence tables
        this.absenceTable.forEach(studentAbsences => {
            studentAbsences.delete(columnName);
        });
        
        // Remove column from all student hidden grades tables
        this.hiddenGrades.forEach(studentHiddenGrades => {
            studentHiddenGrades.delete(columnName);
        });
        
        // Remove column from periods and clean up empty periods
        const periodsToDelete = [];
        this.periods.forEach((period, periodId) => {
            const columnIndex = period.columns.indexOf(columnName);
            if (columnIndex !== -1) {
                period.columns.splice(columnIndex, 1);
                
                // If period has no columns left, mark for deletion
                if (period.columns.length === 0) {
                    periodsToDelete.push(periodId);
                }
            }
        });
        
        // Delete empty periods
        periodsToDelete.forEach(periodId => {
            this.periods.delete(periodId);
            // Update active period if necessary
            if (this.activePeriodId === periodId) {
                this.activePeriodId = null;
            }
        });

        this.saveCurrentClassState();
        this.showExtendedGradeTable();
    }

    updateGrade(input) {
        // Convert studentId to number to match the student.id type used elsewhere
        const studentId = parseFloat(input.dataset.studentId);
        const column = input.dataset.column;
        let grade = input.value.trim();

        // German number format conversion: convert "." to "," and append ".0" for whole numbers
        if (grade) {
            // Replace "." with ","
            grade = grade.replace('.', ',');
            
            // Check if it's a whole number and append ",0"
            if (/^\d+$/.test(grade)) {
                grade += ',0';
            }
            
            // Update the input field to show the formatted value
            input.value = grade;
        }

        // Check if student is marked absent for this date
        const studentAbsences = this.absenceTable.get(studentId);
        if (studentAbsences && studentAbsences.get(column)) {
            input.value = ''; // Clear value if trying to enter grade for absent student
            return;
        }

        // Convert comma to dot for numeric validation (parseFloat expects dots)
        const gradeForValidation = grade.replace(',', '.');

        // Validate grade
        if (grade && (isNaN(parseFloat(gradeForValidation)) || parseFloat(gradeForValidation) < 1.0 || parseFloat(gradeForValidation) > 6.0)) {
            alert('Bitte geben Sie eine gültige Note zwischen 1,0 und 6,0 ein.');
            
            // Get current saved grade for this student and column to restore it
            const studentGrades = this.gradeTable.get(studentId);
            const savedGrade = studentGrades ? studentGrades.get(column) : null;
            
            // Reset to saved grade in German format (or empty if no saved grade exists)
            if (savedGrade !== null && savedGrade !== undefined) {
                input.value = savedGrade.toString().replace('.', ',');
            } else {
                input.value = '';
            }
            input.focus();
            input.select(); // Select the text for easy editing
            return;
        }

        // Update grade table - store normalized numeric value (with dot as decimal separator)
        if (!this.gradeTable.has(studentId)) {
            this.gradeTable.set(studentId, new Map());
        }
        
        if (grade) {
            // Store the normalized numeric value (dot notation) for calculations
            const normalizedGrade = parseFloat(gradeForValidation);
            this.gradeTable.get(studentId).set(column, normalizedGrade);
        } else {
            this.gradeTable.get(studentId).delete(column);
        }

        // Update cell styling (use dot notation for parseFloat)
        const gradeValue = parseFloat(gradeForValidation);
        input.className = 'grade-input';
        if (!isNaN(gradeValue)) {
            if (gradeValue >= 1.0 && gradeValue <= 1.5) input.className += ' grade-1';
            else if (gradeValue > 1.5 && gradeValue <= 2.5) input.className += ' grade-2';
            else if (gradeValue > 2.5 && gradeValue <= 3.5) input.className += ' grade-3';
            else if (gradeValue > 3.5 && gradeValue <= 4.5) input.className += ' grade-4';
            else if (gradeValue > 4.5 && gradeValue <= 5.5) input.className += ' grade-5';
            else input.className += ' grade-6';
        }

        // Recalculate and update average for this student
        this.updateStudentAverage(studentId);
        
        // Update period grades that contain this column
        this.updatePeriodGradesForColumn(studentId, column);
        
        this.saveCurrentClassState();
    }

    updatePeriodGradesForColumn(studentId, column) {
        // Find all periods that contain this column
        const affectedPeriods = [];
        this.periods.forEach((period, periodId) => {
            if (period.columns.includes(column)) {
                affectedPeriods.push(periodId);
            }
        });

        // Update period grade cells for this student in the current table
        affectedPeriods.forEach(periodId => {
            const periodGrade = this.calculatePeriodGrade(studentId, periodId);
            const periodGradeDisplay = periodGrade !== null ? periodGrade.toFixed(1).replace('.', ',') : '-';
            
            // Find the period grade cell in the DOM and update it
            const periodGradeCell = document.querySelector(
                `td[data-student-id="${studentId}"][data-period-id="${periodId}"]`
            );
            
            if (periodGradeCell) {
                // Update the text content of the <strong> element inside the cell
                const strongElement = periodGradeCell.querySelector('strong');
                if (strongElement) {
                    strongElement.textContent = periodGradeDisplay;
                }
                
                // Reset and update cell styling based on grade
                let gradeClass = '';
                if (periodGrade !== null && !isNaN(periodGrade)) {
                    if (periodGrade >= 1.0 && periodGrade <= 1.5) gradeClass = 'grade-1';
                    else if (periodGrade > 1.5 && periodGrade <= 2.5) gradeClass = 'grade-2';
                    else if (periodGrade > 2.5 && periodGrade <= 3.5) gradeClass = 'grade-3';
                    else if (periodGrade > 3.5 && periodGrade <= 4.5) gradeClass = 'grade-4';
                    else if (periodGrade > 4.5 && periodGrade <= 5.5) gradeClass = 'grade-5';
                    else gradeClass = 'grade-6';
                }
                periodGradeCell.className = `period-grade-cell ${gradeClass}`;
            }
        });
    }

    updateStudentAverage(studentId) {
        // Ensure studentId is a number for consistent lookups
        const numericStudentId = typeof studentId === 'string' ? parseFloat(studentId) : studentId;
        
        // Use the new period-based average calculation
        const average = this.calculateStudentAverage(numericStudentId);

        // Find and update average cell in current table
        const row = document.querySelector(`input[data-student-id="${numericStudentId}"]`)?.closest('tr');
        if (row) {
            const avgCell = row.children[2]; // Third column is average
            avgCell.innerHTML = `<strong>${average}</strong>`;
        }
    }

    // Keep old showGradeTable for backward compatibility
    showGradeTable() {
        if (!this.currentClassId || !this.showGrades) {
            return;
        }

        // Collect all students with their grades
        const studentsWithGrades = [];

        this.students.forEach(student => {
            const grade = this.calculateGrade(student.id);
            studentsWithGrades.push({
                lastName: student.lastName,
                firstName: student.firstName,
                grade: grade,
                gradeValue: parseFloat(grade)
            });
        });

        // Sort using the same logic as extended table
        const pseudoDateColumns = []; // No date columns in simple grade table
        this.sortStudents(studentsWithGrades, pseudoDateColumns);

        // Store sorted students for PDF export
        this.sortedStudentsWithGrades = studentsWithGrades;

        // Create table HTML
        let tableHTML = `
            <table class="grade-table">
                <thead>
                    <tr>
                        <th>Nachname</th>
                        <th>Vorname</th>
                        <th>Note</th>
                    </tr>
                </thead>
                <tbody>
        `;

        studentsWithGrades.forEach(student => {
            let gradeClass = '';
            if (student.gradeValue >= 1.0 && student.gradeValue <= 1.5) {
                gradeClass = 'grade-1';
            } else if (student.gradeValue > 1.5 && student.gradeValue <= 2.5) {
                gradeClass = 'grade-2';
            } else if (student.gradeValue > 2.5 && student.gradeValue <= 3.5) {
                gradeClass = 'grade-3';
            } else if (student.gradeValue > 3.5 && student.gradeValue <= 4.5) {
                gradeClass = 'grade-4';
            } else if (student.gradeValue > 4.5 && student.gradeValue <= 5.5) {
                gradeClass = 'grade-5';
            } else {
                gradeClass = 'grade-6';
            }

            tableHTML += `
                <tr>
                    <td>${student.lastName}</td>
                    <td>${student.firstName}</td>
                    <td><span class="grade-cell ${gradeClass}">${student.grade}</span></td>
                </tr>
            `;
        });

        tableHTML += `
                </tbody>
            </table>
        `;

        // Insert table into modal and show
        document.getElementById('gradeTableContainer').innerHTML = tableHTML;
        document.getElementById('gradeTableModal').style.display = 'block';
    }

    exportGradesToPDF() {
        if (!this.currentClassId || this.students.length === 0) {
            alert('Keine Notendaten zum Exportieren verfügbar.');
            return;
        }

        // Check if we have any grade data
        const hasGradeData = this.students.some(student => this.gradeTable.has(student.id));
        if (!hasGradeData) {
            alert('Keine Notendaten zum Exportieren verfügbar.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape'); // Use landscape for more columns

        // Get current class name
        const currentClass = this.classes.get(this.currentClassId);
        const className = currentClass ? currentClass.name : 'Unbekannte Klasse';

        // Get all date columns and generate period groups
        const dateColumns = new Set();
        this.gradeTable.forEach(studentGrades => {
            studentGrades.forEach((grade, date) => {
                dateColumns.add(date);
            });
        });
        const sortedDateColumns = Array.from(dateColumns).sort();
        const periodGroups = this.generatePeriodGroups(sortedDateColumns);

        // Title
        doc.setFontSize(16);
        doc.text(`Notentabelle - ${className}`, 20, 20);

        // Date
        doc.setFontSize(10);
        doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 20, 30);

        // Prepare data for students
        const studentsWithGrades = [];
        this.students.forEach(student => {
            const studentGrades = this.gradeTable.get(student.id) || new Map();
            const studentAbsences = this.absenceTable.get(student.id) || new Map();
            const studentLateness = this.latenessTable.get(student.id) || new Map();
            const average = this.calculateStudentAverage(student.id);

            studentsWithGrades.push({
                id: student.id,
                lastName: student.lastName,
                firstName: student.firstName,
                grades: studentGrades,
                absences: studentAbsences,
                lateness: studentLateness,
                average: average
            });
        });

        // Sort by last name
        studentsWithGrades.sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'));

        // Calculate column headers
        const headers = ['Nachname', 'Vorname', 'Durchschnitt', 'Verspätungen'];
        periodGroups.forEach(group => {
            group.columns.forEach(dateColumn => {
                headers.push(dateColumn);
            });
            // Add period grade column for multi-day periods
            if (group.columns.length > 1 && group.periodId) {
                headers.push(`${group.name} (Note)`);
            }
        });

        // Table headers
        doc.setFontSize(8);
        let xPosition = 20;
        let maxWidth = 270; // Available width in landscape
        let columnWidth = Math.min(25, maxWidth / headers.length);
        
        headers.forEach(header => {
            doc.text(header, xPosition, 50);
            xPosition += columnWidth;
        });

        // Line under headers
        doc.line(20, 55, xPosition, 55);

        // Table content
        let yPosition = 65;
        studentsWithGrades.forEach(student => {
            // Check if we need a new page
            if (yPosition > 180) { // Adjusted for landscape
                doc.addPage('landscape');
                yPosition = 20;
                
                // Repeat headers on new page
                doc.setFontSize(8);
                let headerX = 20;
                headers.forEach(header => {
                    doc.text(header, headerX, yPosition);
                    headerX += columnWidth;
                });
                doc.line(20, yPosition + 5, headerX, yPosition + 5);
                yPosition += 15;
            }

            let dataX = 20;
            
            // Student name, average and lateness count
            doc.text(student.lastName, dataX, yPosition);
            dataX += columnWidth;
            doc.text(student.firstName, dataX, yPosition);
            dataX += columnWidth;
            doc.text(student.average, dataX, yPosition);
            dataX += columnWidth;
            doc.text(student.latenessCount ? student.latenessCount.toString() : '0', dataX, yPosition);
            dataX += columnWidth;

            // Grades for each period group
            periodGroups.forEach(group => {
                group.columns.forEach(dateColumn => {
                    const isAbsent = student.absences.get(dateColumn) || false;
                    const latenessLevel = student.lateness.get(dateColumn) || 0;
                    const isLate = latenessLevel > 0;
                    let grade = student.grades.get(dateColumn) || '-';
                    
                    if (isAbsent) {
                        grade = 'Abw';
                    } else if (isLate && grade !== '-') {
                        // Add lateness marker with level
                        const latenessMarker = latenessLevel === 5 ? 'V5' : latenessLevel === 10 ? 'V10' : 'V15+';
                        grade = grade + ` (${latenessMarker})`;
                    } else if (isLate && grade === '-') {
                        const latenessMarker = latenessLevel === 5 ? 'V5' : latenessLevel === 10 ? 'V10' : 'V15+';
                        grade = latenessMarker;
                    }
                    doc.text(grade.toString(), dataX, yPosition);
                    dataX += columnWidth;
                });
                
                // Add period grade for multi-day periods
                if (group.columns.length > 1 && group.periodId) {
                    const periodGrade = this.calculatePeriodGrade(student.id, group.periodId);
                    const periodGradeText = periodGrade !== null ? periodGrade.toFixed(1) : '-';
                    doc.text(periodGradeText, dataX, yPosition);
                    dataX += columnWidth;
                }
            });
            
            yPosition += 10;
        });

        // Save the PDF
        const fileName = `Notentabelle_${className.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
    }

    exportGradesToExcel() {
        if (!this.currentClassId || this.students.length === 0) {
            alert('Keine Notendaten zum Exportieren verfügbar.');
            return;
        }

        // Check if we have any grade data
        const hasGradeData = this.students.some(student => this.gradeTable.has(student.id));
        if (!hasGradeData) {
            alert('Keine Notendaten zum Exportieren verfügbar.');
            return;
        }

        // Get current class name
        const currentClass = this.classes.get(this.currentClassId);
        const className = currentClass ? currentClass.name : 'Unbekannte Klasse';

        // Get all date columns and generate period groups
        const dateColumns = new Set();
        this.gradeTable.forEach(studentGrades => {
            studentGrades.forEach((grade, date) => {
                dateColumns.add(date);
            });
        });
        const sortedDateColumns = Array.from(dateColumns).sort();
        const periodGroups = this.generatePeriodGroups(sortedDateColumns);

        // Prepare data for students
        const studentsWithGrades = [];
        this.students.forEach(student => {
            const studentGrades = this.gradeTable.get(student.id) || new Map();
            const studentAbsences = this.absenceTable.get(student.id) || new Map();
            const studentLateness = this.latenessTable.get(student.id) || new Map();
            const average = this.calculateStudentAverage(student.id);

            studentsWithGrades.push({
                id: student.id,
                lastName: student.lastName,
                firstName: student.firstName,
                grades: studentGrades,
                absences: studentAbsences,
                lateness: studentLateness,
                average: average
            });
        });

        // Sort by last name
        studentsWithGrades.sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'));

        // Prepare data for Excel export
        const excelData = [];
        
        // Create header rows - we need two rows for period grouping
        const periodHeaderRow = ['', '', '', '']; // Empty cells for name, average and lateness columns  
        const dateHeaderRow = ['Nachname', 'Vorname', 'Durchschnitt', 'Verspätungen'];
        
        periodGroups.forEach(group => {
            if (group.columns.length > 1) {
                // Multi-day period - add period header spanning multiple columns
                const spanCount = group.columns.length + (group.periodId ? 1 : 0); // +1 for period grade
                periodHeaderRow.push(`${group.name} (${group.columns.length} Tage)`);
                for (let i = 1; i < spanCount; i++) {
                    periodHeaderRow.push(''); // Empty cells for spanning
                }
            } else {
                // Single day - just add empty cell
                periodHeaderRow.push('');
            }
            
            // Add individual date headers
            group.columns.forEach(dateColumn => {
                dateHeaderRow.push(dateColumn);
            });
            
            // Add period grade column for multi-day periods
            if (group.columns.length > 1 && group.periodId) {
                dateHeaderRow.push(`${group.name} (Note)`);
            }
        });
        
        // Check if we have multi-day periods and add headers accordingly
        const hasMultiDayPeriods = periodGroups.some(group => group.columns.length > 1);
        if (hasMultiDayPeriods) {
            excelData.push(periodHeaderRow);
        }
        excelData.push(dateHeaderRow);
        
        // Add student data
        studentsWithGrades.forEach(student => {
            const row = [student.lastName, student.firstName];
            
            // Convert average with comma for German locale
            const averageWithComma = student.average ? student.average.replace('.', ',') : '';
            row.push(averageWithComma);
            
            // Add lateness count
            row.push(student.latenessCount.toString());

            // Add grades for each period group
            periodGroups.forEach(group => {
                group.columns.forEach(dateColumn => {
                    const isAbsent = student.absences.get(dateColumn) || false;
                    const latenessLevel = student.lateness.get(dateColumn) || 0;
                    const isLate = latenessLevel > 0;
                    let grade = '';
                    
                    if (isAbsent) {
                        grade = 'Abw';
                    } else if (isLate) {
                        const baseGrade = student.grades.get(dateColumn) || '';
                        const latenessMarker = latenessLevel === 5 ? 'V5' : latenessLevel === 10 ? 'V10' : 'V15+';
                        grade = baseGrade ? `${baseGrade.toString().replace('.', ',')} (${latenessMarker})` : latenessMarker;
                    } else {
                        grade = student.grades.get(dateColumn) || '';
                        // Convert grade from dot to comma for German locale
                        grade = grade ? grade.toString().replace('.', ',') : '';
                    }
                    row.push(grade);
                });
                
                // Add period grade for multi-day periods
                if (group.columns.length > 1 && group.periodId) {
                    const periodGrade = this.calculatePeriodGrade(student.id, group.periodId);
                    const periodGradeText = periodGrade !== null ? periodGrade.toFixed(1).replace('.', ',') : '';
                    row.push(periodGradeText);
                }
            });
            
            excelData.push(row);
        });

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(excelData);

        // Set column widths dynamically
        const totalColumns = dateHeaderRow.length;
        const columnWidths = [
            { width: 20 }, // Nachname
            { width: 20 }, // Vorname
            { width: 12 }, // Durchschnitt
            { width: 12 }, // Verspätungen
        ];
        
        // Add widths for remaining columns
        for (let i = 3; i < totalColumns; i++) {
            columnWidths.push({ width: 12 });
        }
        
        ws['!cols'] = columnWidths;

        // Style the header rows and add merges for period headers
        const headerRange = XLSX.utils.decode_range(ws['!ref']);
        const headerRowCount = hasMultiDayPeriods ? 2 : 1;
        
        for (let row = 0; row < headerRowCount; row++) {
            for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                if (ws[cellAddress]) {
                    ws[cellAddress].s = {
                        font: { bold: true },
                        fill: { fgColor: { rgb: "CCCCCC" } }
                    };
                }
            }
        }

        // Add cell merges for period headers if we have multi-day periods
        if (hasMultiDayPeriods) {
            const merges = [];
            let currentCol = 4; // Start after Nachname, Vorname, Durchschnitt, Verspätungen
            
            periodGroups.forEach(group => {
                if (group.columns.length > 1) {
                    const spanCount = group.columns.length + (group.periodId ? 1 : 0);
                    if (spanCount > 1) {
                        // Merge cells for period header
                        merges.push({
                            s: { r: 0, c: currentCol },
                            e: { r: 0, c: currentCol + spanCount - 1 }
                        });
                    }
                    currentCol += spanCount;
                } else {
                    currentCol += 1;
                }
            });
            
            if (merges.length > 0) {
                ws['!merges'] = merges;
            }
        }

        // Add worksheet to workbook with class name as sheet name
        XLSX.utils.book_append_sheet(wb, ws, className.substring(0, 31)); // Excel sheet names max 31 chars

        // Generate filename and download
        const fileName = `Notentabelle_${className.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }

}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.seatingPlan = new SeatingPlan();
});