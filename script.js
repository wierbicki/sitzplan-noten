class SeatingPlan {
    constructor() {
        this.classes = new Map(); // Store all classes and their data
        this.currentClassId = null;
        this.students = [];
        this.seats = [];
        this.draggedElement = null;
        this.gridRows = 5;
        this.gridColumns = 6;
        this.currentEditingStudent = null;
        this.studentCounters = new Map(); // Store counters for each student
        this.longPressTimer = null;
        this.isLongPress = false;
        this.longPressDelay = 500; // 500ms for long press
        this.showGrades = false; // Toggle for grade display
        this.startingGrade = 4.0; // Default starting grade
        this.init();
    }

    init() {
        this.createSeats();
        this.bindEvents();
        this.loadClasses();
        this.updateClassSelect();
    }

    createSeats() {
        const grid = document.getElementById('classroomGrid');
        grid.innerHTML = '';
        this.seats = [];

        // Update CSS grid layout
        grid.style.gridTemplateColumns = `repeat(${this.gridColumns}, 1fr)`;
        grid.style.gridTemplateRows = `repeat(${this.gridRows}, 1fr)`;

        const seatCount = this.gridRows * this.gridColumns;

        for (let i = 0; i < seatCount; i++) {
            const seat = document.createElement('div');
            seat.className = 'seat';
            seat.dataset.seatId = i;
            seat.innerHTML = '<span style="color: #8e8e93; font-size: 12px;">Platz ' + (i + 1) + '</span>';

            // Add drag and drop events
            seat.addEventListener('dragover', this.handleDragOver.bind(this));
            seat.addEventListener('drop', this.handleDrop.bind(this));
            seat.addEventListener('dragleave', this.handleDragLeave.bind(this));

            grid.appendChild(seat);
            this.seats.push({
                element: seat,
                student: null,
                id: i
            });
        }
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
                this.resetAllSeats();
            }
        });

        document.getElementById('resetCounters').addEventListener('click', () => {
            this.resetAllCounters();
        });

        document.getElementById('studentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addStudent();
        });

        // Grid control events
        document.getElementById('addRow').addEventListener('click', () => {
            this.addRow();
        });

        document.getElementById('removeRow').addEventListener('click', () => {
            this.removeRow();
        });

        document.getElementById('addColumn').addEventListener('click', () => {
            this.addColumn();
        });

        document.getElementById('removeColumn').addEventListener('click', () => {
            this.removeColumn();
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

        // Class management events
        document.getElementById('addClass').addEventListener('click', () => {
            document.getElementById('classModal').style.display = 'block';
        });

        document.getElementById('cancelClassModal').addEventListener('click', () => {
            document.getElementById('classModal').style.display = 'none';
            document.getElementById('classForm').reset();
        });

        document.getElementById('classForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addClass();
        });

        document.getElementById('classSelect').addEventListener('change', (e) => {
            this.switchClass(e.target.value);
        });

        document.getElementById('deleteClass').addEventListener('click', () => {
            this.deleteCurrentClass();
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
            }
        });
    }

    loadClasses() {
        const savedClasses = localStorage.getItem('seatingPlan_classes');
        if (savedClasses) {
            const classesData = JSON.parse(savedClasses);
            this.classes = new Map(classesData.map(cls => [cls.id, cls]));
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
            seatAssignments: new Map(),
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
    }

    switchClass(classId) {
        if (!classId || !this.classes.has(classId)) {
            this.currentClassId = null;
            this.students = [];
            this.studentCounters = new Map();
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
        this.gridRows = classData.gridRows || 5;
        this.gridColumns = classData.gridColumns || 6;
        this.showGrades = classData.showGrades || false;
        this.startingGrade = classData.startingGrade || 4.0;

        // Update UI
        this.createSeats();
        this.loadSeatAssignments(classData.seatAssignments || new Map());
        this.updateUI();
        
        // Update class selector
        document.getElementById('classSelect').value = classId;
        document.getElementById('deleteClass').style.display = this.classes.size > 1 ? 'inline-block' : 'none';
    }

    saveCurrentClassState() {
        if (!this.currentClassId || !this.classes.has(this.currentClassId)) return;

        const classData = this.classes.get(this.currentClassId);
        classData.students = this.students;
        classData.studentCounters = this.studentCounters;
        classData.seatAssignments = this.getSeatAssignments();
        classData.gridRows = this.gridRows;
        classData.gridColumns = this.gridColumns;
        classData.showGrades = this.showGrades;
        classData.startingGrade = this.startingGrade;

        this.classes.set(this.currentClassId, classData);
        this.saveClasses();
    }

    getSeatAssignments() {
        const assignments = new Map();
        this.seats.forEach((seat, index) => {
            if (seat.student) {
                assignments.set(index, seat.student.id);
            }
        });
        return assignments;
    }

    loadSeatAssignments(assignments) {
        assignments.forEach((studentId, seatIndex) => {
            const student = this.students.find(s => s.id === studentId);
            if (student && this.seats[seatIndex]) {
                this.assignStudentToSeat(studentId, seatIndex);
            }
        });
    }

    updateClassSelect() {
        const select = document.getElementById('classSelect');
        select.innerHTML = '<option value="">Klasse auswählen...</option>';

        this.classes.forEach((classData, id) => {
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
            seatAssignments: Array.from(classData.seatAssignments.entries())
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
        if (this.showGrades) {
            toggleBtn.textContent = 'Zähler anzeigen';
            toggleBtn.style.background = '#34c759';
            toggleBtn.style.color = 'white';
        } else {
            toggleBtn.textContent = 'Noten anzeigen';
            toggleBtn.style.background = '';
            toggleBtn.style.color = '';
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

        this.students.forEach(student => {
            // Only show students who aren't assigned to seats
            const isAssigned = this.seats.some(seat => seat.student && seat.student.id === student.id);
            if (isAssigned) return;

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

        if (student.photo) {
            const img = document.createElement('img');
            img.src = student.photo;
            avatar.appendChild(img);
        } else {
            const initials = student.firstName.charAt(0) + student.lastName.charAt(0);
            avatar.textContent = initials.toUpperCase();
        }

        const name = document.createElement('div');
        name.className = 'student-name';
        name.textContent = `${student.firstName} ${student.lastName}`;

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
        card.appendChild(actions);
        card.appendChild(avatar);
        card.appendChild(name);
        card.appendChild(counter);

        // Add drag events
        card.addEventListener('dragstart', this.handleDragStart.bind(this));
        card.addEventListener('dragend', this.handleDragEnd.bind(this));

        // Add counter events (only for seated students)
        if (this.seats.some(seat => seat.student && seat.student.id === student.id)) {
            // Mouse events
            card.addEventListener('mousedown', (e) => {
                if (e.target.closest('.student-card-actions')) return; // Don't trigger on edit button
                e.preventDefault();
                this.handleCounterPress(student.id);
            });

            card.addEventListener('mouseup', (e) => {
                if (e.target.closest('.student-card-actions')) return;
                e.preventDefault();
                this.handleCounterRelease(student.id);
            });

            

            // Touch events for mobile
            card.addEventListener('touchstart', (e) => {
                if (e.target.closest('.student-card-actions')) return;
                e.preventDefault();
                this.handleCounterPress(student.id);
            });

            card.addEventListener('touchend', (e) => {
                if (e.target.closest('.student-card-actions')) return;
                e.preventDefault();
                this.handleCounterRelease(student.id);
            });

            card.addEventListener('touchcancel', (e) => {
                this.handleCounterRelease(student.id);
            });

            // Disable drag for seated students to prevent conflicts
            card.draggable = false;
        } else {
            // Double click to remove from seat (only for students in pool)
            card.addEventListener('dblclick', () => {
                this.removeStudentFromSeat(student.id);
            });
        }

        return card;
    }

    handleDragStart(e) {
        this.draggedElement = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedElement = null;
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.target.closest('.seat').classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.target.closest('.seat').classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        const seatElement = e.target.closest('.seat');
        seatElement.classList.remove('drag-over');

        if (!this.draggedElement) return;

        const studentId = this.draggedElement.dataset.studentId;
        const seatId = parseInt(seatElement.dataset.seatId);

        this.assignStudentToSeat(studentId, seatId);
    }

    assignStudentToSeat(studentId, seatId) {
        const student = this.students.find(s => s.id == studentId);
        const seat = this.seats[seatId];

        if (!student || !seat) return;

        // Remove student from any existing seat
        this.removeStudentFromSeat(studentId);

        // If seat is occupied, move that student back to pool
        if (seat.student) {
            this.removeStudentFromSeat(seat.student.id);
        }

        // Assign student to seat
        seat.student = student;
        seat.element.innerHTML = '';
        seat.element.classList.add('occupied');

        const studentCard = this.createStudentCard(student);
        seat.element.appendChild(studentCard);

        // Update student pool
        this.renderStudentPool();
    }

    removeStudentFromSeat(studentId) {
        const seat = this.seats.find(s => s.student && s.student.id == studentId);
        if (seat) {
            seat.student = null;
            seat.element.classList.remove('occupied');
            seat.element.innerHTML = `<span style="color: #8e8e93; font-size: 12px;">Platz ${seat.id + 1}</span>`;
        }
        this.renderStudentPool();
    }

    resetAllSeats() {
        this.seats.forEach(seat => {
            seat.student = null;
            seat.element.classList.remove('occupied');
            seat.element.innerHTML = `<span style="color: #8e8e93; font-size: 12px;">Platz ${seat.id + 1}</span>`;
        });
        this.studentCounters.clear(); // Clear counters as well
        this.renderStudentPool();
    }

    resetAllCounters() {
        if (confirm('Möchten Sie wirklich alle Zähler in dieser Klasse zurücksetzen?')) {
            this.studentCounters.clear();
            this.updateAllCounterDisplays();
            this.renderStudentPool();
            this.saveCurrentClassState();
        }
    }

    addRow() {
        // Move all students back to pool before changing grid
        this.resetAllSeats();
        this.gridRows++;
        this.createSeats();
        this.saveCurrentClassState();
    }

    removeRow() {
        if (this.gridRows <= 1) return;

        // Move all students back to pool before changing grid
        this.resetAllSeats();
        this.gridRows--;
        this.createSeats();
        this.saveCurrentClassState();
    }

    addColumn() {
        // Move all students back to pool before changing grid
        this.resetAllSeats();
        this.gridColumns++;
        this.createSeats();
        this.saveCurrentClassState();
    }

    removeColumn() {
        if (this.gridColumns <= 1) return;

        // Move all students back to pool before changing grid
        this.resetAllSeats();
        this.gridColumns--;
        this.createSeats();
        this.saveCurrentClassState();
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

        if (confirm(`Möchten Sie ${this.currentEditingStudent.firstName} ${this.currentEditingStudent.lastName} aus dem Grid entfernen?`)) {
            // Remove from any seat (but keep in students array)
            this.removeStudentFromSeat(this.currentEditingStudent.id);

            // Clear counter for this student
            this.studentCounters.delete(this.currentEditingStudent.id);

            // Close modal and refresh
            document.getElementById('studentModal').style.display = 'none';
            this.clearForm();
            this.renderStudentPool();
        }
    }

    updateStudentEverywhere(student) {
        // Update in seats if assigned
        const assignedSeat = this.seats.find(seat => seat.student && seat.student.id === student.id);
        if (assignedSeat) {
            assignedSeat.student = student;
            assignedSeat.element.innerHTML = '';
            assignedSeat.element.classList.add('occupied');
            const studentCard = this.createStudentCard(student);
            assignedSeat.element.appendChild(studentCard);
        }

        // Update student pool
        this.renderStudentPool();
    }

    handleCounterPress(studentId) {
        this.isLongPress = false;
        
        // Set timer for long press
        this.longPressTimer = setTimeout(() => {
            this.isLongPress = true;
            this.decrementCounter(studentId);
        }, this.longPressDelay);
    }

    handleCounterRelease(studentId) {
        // Clear the timer
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        // If it wasn't a long press, it's a short click - increment
        if (!this.isLongPress) {
            this.incrementCounter(studentId);
        }

        this.isLongPress = false;
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
        const seat = this.seats.find(s => s.student && s.student.id == studentId);
        if (seat) {
            const counterElement = seat.element.querySelector('.student-counter');
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
            toggleBtn.textContent = 'Schülerliste ausblenden';
        } else {
            sidebar.style.display = 'none';
            toggleBtn.textContent = 'Schülerliste einblenden';
        }
    }

    toggleHeader() {
        const header = document.querySelector('.header');
        const toggleBtn = document.getElementById('toggleHeader');
        
        if (header.style.display === 'none') {
            header.style.display = 'flex';
            toggleBtn.textContent = 'Header ausblenden';
            this.removeFloatingHeaderButton();
        } else {
            header.style.display = 'none';
            toggleBtn.textContent = 'Header einblenden';
            this.createFloatingHeaderButton();
        }
    }

    createFloatingHeaderButton() {
        // Remove any existing floating button
        this.removeFloatingHeaderButton();
        
        const floatingBtn = document.createElement('button');
        floatingBtn.className = 'floating-header-toggle';
        floatingBtn.id = 'floatingHeaderToggle';
        floatingBtn.textContent = 'Header einblenden';
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
        this.seats.forEach(seat => {
            if (seat.student) {
                this.updateCounterDisplay(seat.student.id);
            }
        });
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new SeatingPlan();
});