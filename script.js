class SeatingPlan {
    constructor() {
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
        this.isDragging = false; // Track if drag operation is active
        this.dragStartPosition = null; // Track initial position for drag detection
        this.isEditingClass = false; // Track if we're editing a class
        this.editingClassId = null; // Track which class is being edited
        
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
        // Create some default single and double desks
        const defaultDesks = [
            { type: 'single', x: 50, y: 50, capacity: 1, students: [] },
            { type: 'double', x: 200, y: 50, capacity: 2, students: [] },
            { type: 'single', x: 350, y: 50, capacity: 1, students: [] },
            { type: 'double', x: 50, y: 200, capacity: 2, students: [] },
            { type: 'single', x: 200, y: 200, capacity: 1, students: [] },
            { type: 'double', x: 350, y: 200, capacity: 2, students: [] }
        ];

        defaultDesks.forEach((deskData, index) => {
            this.desks.push({
                id: index,
                type: deskData.type,
                x: deskData.x,
                y: deskData.y,
                capacity: deskData.capacity,
                students: [],
                element: null
            });
        });
    }

    renderDesks() {
        const classroom = document.getElementById('classroomGrid');
        
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
            deskEl.style.width = '200px';
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
        deskElement.innerHTML = '';

        if (desk.students.length === 0) {
            // Empty desk - show desk number and type
            const label = document.createElement('div');
            label.className = 'desk-label';
            label.textContent = `${desk.type === 'single' ? 'Einzeltisch' : 'Doppeltisch'}`;
            deskElement.appendChild(label);
        } else {
            // Desk with students
            desk.students.forEach((student, index) => {
                const studentCard = this.createStudentCard(student);
                
                // For double desks, apply positioning based on deskPosition property
                if (desk.type === 'double' && student.deskPosition) {
                    if (student.deskPosition === 'left') {
                        studentCard.style.alignSelf = 'flex-start';
                        studentCard.style.marginRight = desk.students.length === 1 ? 'auto' : '5px';
                    } else if (student.deskPosition === 'right') {
                        studentCard.style.alignSelf = 'flex-end';
                        studentCard.style.marginLeft = desk.students.length === 1 ? 'auto' : '5px';
                    }
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
        const maxY = classroomRect.height - deskHeight;
        
        // Snap to grid first (25px grid for easy alignment)
        const gridSize = 25;
        let snappedX = Math.round(newX / gridSize) * gridSize;
        let snappedY = Math.round(newY / gridSize) * gridSize;
        
        // Then ensure bounds are respected after snapping
        const boundedX = Math.max(minX, Math.min(maxX, snappedX));
        const boundedY = Math.max(minY, Math.min(maxY, snappedY));
        
        // Update desk position
        this.currentDraggedDesk.element.style.left = boundedX + 'px';
        this.currentDraggedDesk.element.style.top = boundedY + 'px';
        
        // Update desk data
        this.currentDraggedDesk.x = boundedX;
        this.currentDraggedDesk.y = boundedY;
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
        const newDesk = {
            id: this.desks.length,
            type: type,
            x: 100 + (this.desks.length * 50),
            y: 100 + (this.desks.length * 30),
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

    enterDeskRemovalMode() {
        // Simple implementation - could be enhanced with visual feedback
        alert('Klicken Sie auf einen Tisch, um ihn zu entfernen.');
        
        const removeHandler = (event) => {
            const desk = this.getDeskFromElement(event.target);
            if (desk) {
                this.removeDesk(desk.id);
                document.removeEventListener('click', removeHandler);
            }
        };
        
        document.addEventListener('click', removeHandler);
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
            this.showGradeTable();
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

        document.getElementById('exportData').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('importData').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });

        document.getElementById('importFile').addEventListener('change', (e) => {
            this.importData(e.target.files[0]);
        });

        // Dropdown menu functionality
        document.getElementById('moreOptions').addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('dropdownContent');
            dropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown-menu')) {
                document.getElementById('dropdownContent').classList.remove('show');
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
    }

    loadClasses() {
        const savedClasses = localStorage.getItem('seatingPlan_classes');
        if (savedClasses) {
            const classesData = JSON.parse(savedClasses);
            this.classes = new Map(classesData.map(cls => [cls.id, cls]));
            
            // Normalize all classes data types after loading from localStorage
            this.classes.forEach((classData, classId) => {
                classData.studentCounters = new Map(classData.studentCounters || []);
                classData.deskAssignments = new Map(classData.deskAssignments || []);
                // Handle legacy seatAssignments
                if (classData.seatAssignments && !classData.deskAssignments) {
                    classData.deskAssignments = new Map();
                }
            });
            
            // Automatically select the first available class after loading
            if (this.classes.size > 0) {
                const firstClassId = this.classes.keys().next().value;
                this.switchClass(firstClassId);
            }
        }

        // If no classes exist, create a default one
        if (this.classes.size === 0) {
            this.createDefaultClass();
        }
    }

    createDefaultClass() {
        const defaultClass = {
            id: 'default_' + Date.now(),
            name: 'Beispielklasse',
            students: [
                { id: Date.now() + Math.random(), firstName: 'Max', lastName: 'Mustermann', photo: null },
                { id: Date.now() + Math.random() + 1, firstName: 'Anna', lastName: 'Schmidt', photo: null },
                { id: Date.now() + Math.random() + 2, firstName: 'Tom', lastName: 'Weber', photo: null },
                { id: Date.now() + Math.random() + 3, firstName: 'Lisa', lastName: 'Mueller', photo: null },
                { id: Date.now() + Math.random() + 4, firstName: 'Paul', lastName: 'Wagner', photo: null }
            ],
            studentCounters: new Map(),
            seatAssignments: new Map(),
            gridRows: 5,
            gridColumns: 6,
            showGrades: false,
            startingGrade: 4.0
        };

        this.classes.set(defaultClass.id, defaultClass);
        this.currentClassId = defaultClass.id;
        this.switchClass(defaultClass.id);
        this.saveClasses();
    }

    addClass() {
        const className = document.getElementById('className').value.trim();
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
            startingGrade: 4.0
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
            document.getElementById('classModalTitle').textContent = 'Klasse bearbeiten';
            document.getElementById('submitClassButton').textContent = 'Speichern';
        } else {
            this.isEditingClass = false;
            this.editingClassId = null;
            
            document.getElementById('className').value = '';
            document.getElementById('classModalTitle').textContent = 'Neue Klasse anlegen';
            document.getElementById('submitClassButton').textContent = 'Anlegen';
        }
        
        document.getElementById('classModal').style.display = 'block';
    }

    updateClass() {
        const newClassName = document.getElementById('className').value.trim();
        if (!newClassName || !this.editingClassId) return;

        const classData = this.classes.get(this.editingClassId);
        classData.name = newClassName;
        
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
        this.desks = classData.desks || [];
        this.gridRows = classData.gridRows || 5;
        this.gridColumns = classData.gridColumns || 6;
        this.showGrades = classData.showGrades || false;
        this.startingGrade = classData.startingGrade || 4.0;

        // Update UI
        this.createClassroom();
        const deskAssignments = new Map(classData.deskAssignments || []);
        this.loadDeskAssignments(deskAssignments);
        this.updateUI();

        // Update class selector
        document.getElementById('classSelect').value = classId;
        document.getElementById('editClass').style.display = this.currentClassId ? 'inline-block' : 'none';
        document.getElementById('deleteClass').style.display = this.classes.size > 1 ? 'inline-block' : 'none';
    }

    saveCurrentClassState() {
        if (!this.currentClassId || !this.classes.has(this.currentClassId)) return;

        const classData = this.classes.get(this.currentClassId);
        classData.students = this.students;
        classData.studentCounters = this.studentCounters;
        // Remove DOM element references before saving to prevent JSON.stringify errors
        classData.desks = this.desks.map(desk => ({
            id: desk.id,
            type: desk.type,
            x: desk.x,
            y: desk.y,
            capacity: desk.capacity,
            students: desk.students
            // element property excluded - will be rebuilt on load
        }));
        classData.deskAssignments = this.getDeskAssignments();
        classData.gridRows = this.gridRows;
        classData.gridColumns = this.gridColumns;
        classData.showGrades = this.showGrades;
        classData.startingGrade = this.startingGrade;

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

    loadDeskAssignments(assignments) {
        assignments.forEach((studentIds, deskIndex) => {
            if (this.desks[deskIndex]) {
                const desk = this.desks[deskIndex];
                desk.students = [];
                studentIds.forEach(studentId => {
                    const student = this.students.find(s => s.id === studentId);
                    if (student && desk.students.length < desk.capacity) {
                        desk.students.push(student);
                    }
                });
                this.updateDeskContent(desk, desk.element);
            }
        });
    }

    updateClassSelect() {
        const select = document.getElementById('classSelect');
        select.innerHTML = '<option value="">Klasse auswählen...</option>';

        // Convert classes Map to array and sort alphabetically by name
        const sortedClasses = Array.from(this.classes.entries()).sort((a, b) => {
            return a[1].name.localeCompare(b[1].name, 'de');
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

    updateUI() {
        this.renderStudentPool();
        this.updateGradeDisplay();
        this.updateStartingGradeButtons();
    }

    updateGradeDisplay() {
        const toggleBtn = document.getElementById('toggleGrades');
        const gradeTableBtn = document.getElementById('showGradeTable');

        if (this.showGrades) {
            toggleBtn.textContent = 'Zähler anzeigen';
            toggleBtn.style.background = '#34c759';
            toggleBtn.style.color = 'white';
            gradeTableBtn.style.display = 'inline-block';
        } else {
            toggleBtn.textContent = 'Noten anzeigen';
            toggleBtn.style.background = '';
            toggleBtn.style.color = '';
            gradeTableBtn.style.display = 'none';
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

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-edit';
            deleteBtn.innerHTML = '✖';
            deleteBtn.title = 'Löschen';
            deleteBtn.style.background = '#ff3b30';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteStudentCompletely(student.id);
            });
            actions.appendChild(deleteBtn);
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
        e.target.closest('.seat').classList.add('drag-over');
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

        if (!student || !targetDesk) return;

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
                
                // If the existing student has a position, place new student on opposite side
                if (existingStudent.deskPosition === 'left') {
                    student.deskPosition = 'right';
                } else if (existingStudent.deskPosition === 'right') {
                    student.deskPosition = 'left';
                } else {
                    // If existing student has no position, assign based on drop
                    student.deskPosition = dropPosition === 'center' ? 'left' : dropPosition;
                    // Also assign a position to the existing student (opposite)
                    existingStudent.deskPosition = student.deskPosition === 'left' ? 'right' : 'left';
                }
            } else {
                // No existing student, assign the drop position (default to left for center)
                student.deskPosition = dropPosition === 'center' ? 'left' : dropPosition;
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
        const desk = this.desks.find(d => d.students.some(s => s.id == studentId));
        if (desk) {
            const studentIndex = desk.students.findIndex(s => s.id == studentId);
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
        const student = this.students.find(s => s.id == studentId);
        if (student) {
            delete student.deskPosition;
        }
        
        // Only remove from desk, keep in students array
        this.removeStudentFromDesk(studentId);
        this.renderStudentPool();
        this.saveCurrentClassState();
    }

    deleteStudentCompletely(studentId) {
        const student = this.students.find(s => s.id == studentId);
        if (!student) return;

        if (confirm(`Möchten Sie ${student.firstName} ${student.lastName} wirklich komplett löschen?`)) {
            // Remove from any seat
            this.removeStudentFromSeat(studentId);

            // Remove from students array
            this.students = this.students.filter(s => s.id != studentId);

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

        // Convert classes Map to exportable format
        this.classes.forEach((classData, id) => {
            const exportClass = {
                id: id,
                name: classData.name,
                students: classData.students || [],
                studentCounters: Array.from((classData.studentCounters || new Map()).entries()),
                seatAssignments: Array.from((classData.seatAssignments || new Map()).entries()),
                gridRows: classData.gridRows || 5,
                gridColumns: classData.gridColumns || 6,
                showGrades: classData.showGrades || false,
                startingGrade: classData.startingGrade || 4.0
            };
            exportData.classes.push(exportClass);
        });

        // Create and download file
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `sitzplan_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert('Daten erfolgreich exportiert!');
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
                        gridRows: classData.gridRows || 5,
                        gridColumns: classData.gridColumns || 6,
                        showGrades: classData.showGrades || false,
                        startingGrade: classData.startingGrade || 4.0
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

        // Sort by lastname, then firstname
        studentsWithGrades.sort((a, b) => {
            const lastNameCompare = a.lastName.localeCompare(b.lastName, 'de');
            if (lastNameCompare !== 0) return lastNameCompare;
            return a.firstName.localeCompare(b.firstName, 'de');
        });

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
        if (!this.sortedStudentsWithGrades || !this.currentClassId) {
            alert('Keine Notendaten zum Exportieren verfügbar.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Get current class name
        const currentClass = this.classes.get(this.currentClassId);
        const className = currentClass ? currentClass.name : 'Unbekannte Klasse';

        // Title
        doc.setFontSize(16);
        doc.text(`Notentabelle - ${className}`, 20, 20);

        // Date
        doc.setFontSize(10);
        doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 20, 30);

        // Table headers
        doc.setFontSize(12);
        doc.text('Nachname', 20, 50);
        doc.text('Vorname', 80, 50);
        doc.text('Note', 140, 50);

        // Line under headers
        doc.line(20, 55, 180, 55);

        // Table content
        doc.setFontSize(10);
        let yPosition = 65;

        this.sortedStudentsWithGrades.forEach((student, index) => {
            // Check if we need a new page
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
                
                // Repeat headers on new page
                doc.setFontSize(12);
                doc.text('Nachname', 20, yPosition);
                doc.text('Vorname', 80, yPosition);
                doc.text('Note', 140, yPosition);
                doc.line(20, yPosition + 5, 180, yPosition + 5);
                yPosition += 15;
                doc.setFontSize(10);
            }

            doc.text(student.lastName, 20, yPosition);
            doc.text(student.firstName, 80, yPosition);
            doc.text(student.grade, 140, yPosition);
            
            yPosition += 10;
        });

        // Save the PDF
        const fileName = `Notentabelle_${className.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
    }

    exportGradesToExcel() {
        if (!this.sortedStudentsWithGrades || !this.currentClassId) {
            alert('Keine Notendaten zum Exportieren verfügbar.');
            return;
        }

        // Get current class name
        const currentClass = this.classes.get(this.currentClassId);
        const className = currentClass ? currentClass.name : 'Unbekannte Klasse';

        // Prepare data for Excel export
        const excelData = [];
        
        // Add header row
        excelData.push(['Nachname', 'Vorname', 'Note']);
        
        // Add student data
        this.sortedStudentsWithGrades.forEach(student => {
            // Convert grade from dot to comma decimal format
            const gradeWithComma = student.grade.replace('.', ',');
            excelData.push([student.lastName, student.firstName, gradeWithComma]);
        });

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(excelData);

        // Set column widths
        ws['!cols'] = [
            { width: 20 }, // Nachname
            { width: 20 }, // Vorname
            { width: 10 }  // Note
        ];

        // Style the header row
        const headerRange = XLSX.utils.decode_range(ws['!ref']);
        for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            if (ws[cellAddress]) {
                ws[cellAddress].s = {
                    font: { bold: true },
                    fill: { fgColor: { rgb: "CCCCCC" } }
                };
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
    new SeatingPlan();
});