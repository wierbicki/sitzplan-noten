
class SeatingPlan {
    constructor() {
        this.currentClassId = null;
        this.students = [];
        this.seats = [];
        this.draggedElement = null;
        this.gridRows = 5;
        this.gridColumns = 6;
        this.currentEditingStudent = null;
        this.studentCounters = new Map();
        this.longPressTimer = null;
        this.isLongPress = false;
        this.longPressDelay = 500;
        this.showGrades = false;
        this.startingGrade = 4.0;
        this.init();
    }

    async init() {
        this.createSeats();
        this.bindEvents();
        await this.loadClasses();
        this.updateClassSelect();
    }

    // API helper methods
    async apiCall(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    async loadClasses() {
        try {
            const classes = await this.apiCall('/api/classes');
            this.classes = new Map(classes.map(cls => [cls.id.toString(), cls]));
            
            if (this.classes.size === 0) {
                await this.createDefaultClass();
            }
        } catch (error) {
            console.error('Error loading classes:', error);
            alert('Fehler beim Laden der Klassen. Bitte versuchen Sie es erneut.');
        }
    }

    async createDefaultClass() {
        try {
            const defaultClass = await this.apiCall('/api/classes', {
                method: 'POST',
                body: JSON.stringify({
                    name: 'Beispielklasse',
                    gridRows: 5,
                    gridColumns: 6,
                    showGrades: false,
                    startingGrade: 4.0
                })
            });

            // Add some default students
            const defaultStudents = [
                { firstName: 'Max', lastName: 'Mustermann' },
                { firstName: 'Anna', lastName: 'Schmidt' },
                { firstName: 'Tom', lastName: 'Weber' },
                { firstName: 'Lisa', lastName: 'Mueller' },
                { firstName: 'Paul', lastName: 'Wagner' }
            ];

            for (const student of defaultStudents) {
                await this.apiCall(`/api/classes/${defaultClass.id}/students`, {
                    method: 'POST',
                    body: JSON.stringify(student)
                });
            }

            this.classes.set(defaultClass.id.toString(), defaultClass);
            this.currentClassId = defaultClass.id.toString();
            await this.switchClass(defaultClass.id.toString());
        } catch (error) {
            console.error('Error creating default class:', error);
        }
    }

    async addClass() {
        const className = document.getElementById('className').value.trim();
        if (!className) return;

        try {
            const newClass = await this.apiCall('/api/classes', {
                method: 'POST',
                body: JSON.stringify({
                    name: className,
                    gridRows: 5,
                    gridColumns: 6,
                    showGrades: false,
                    startingGrade: 4.0
                })
            });

            this.classes.set(newClass.id.toString(), newClass);
            this.updateClassSelect();
            await this.switchClass(newClass.id.toString());
            
            document.getElementById('classModal').style.display = 'none';
            document.getElementById('classForm').reset();
        } catch (error) {
            console.error('Error creating class:', error);
            alert('Fehler beim Erstellen der Klasse.');
        }
    }

    async switchClass(classId) {
        if (!classId || !this.classes.has(classId)) {
            this.currentClassId = null;
            this.students = [];
            this.studentCounters = new Map();
            this.updateUI();
            return;
        }

        try {
            this.currentClassId = classId;
            const classData = this.classes.get(classId);
            
            // Load students from database
            const students = await this.apiCall(`/api/classes/${classId}/students`);
            this.students = students.map(student => ({
                id: student.id.toString(),
                firstName: student.first_name,
                lastName: student.last_name,
                photo: student.photo,
                counter: student.counter || 0,
                seatPosition: student.seat_position
            }));

            // Build counters map
            this.studentCounters = new Map();
            this.students.forEach(student => {
                this.studentCounters.set(student.id, student.counter);
            });

            this.gridRows = classData.grid_rows || 5;
            this.gridColumns = classData.grid_columns || 6;
            this.showGrades = classData.show_grades || false;
            this.startingGrade = classData.starting_grade || 4.0;

            // Update UI
            this.createSeats();
            this.loadSeatAssignments();
            this.updateUI();
            
            document.getElementById('classSelect').value = classId;
            document.getElementById('deleteClass').style.display = this.classes.size > 1 ? 'inline-block' : 'none';
        } catch (error) {
            console.error('Error switching class:', error);
            alert('Fehler beim Laden der Klasse.');
        }
    }

    loadSeatAssignments() {
        this.students.forEach(student => {
            if (student.seatPosition !== null && student.seatPosition !== undefined) {
                this.assignStudentToSeat(student.id, student.seatPosition, false);
            }
        });
    }

    async saveCurrentClassState() {
        if (!this.currentClassId) return;

        try {
            // Update class settings
            await this.apiCall(`/api/classes/${this.currentClassId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: this.classes.get(this.currentClassId).name,
                    gridRows: this.gridRows,
                    gridColumns: this.gridColumns,
                    showGrades: this.showGrades,
                    startingGrade: this.startingGrade
                })
            });

            // Update seat assignments
            const assignments = [];
            this.seats.forEach((seat, index) => {
                if (seat.student) {
                    assignments.push({
                        studentId: parseInt(seat.student.id),
                        seatPosition: index
                    });
                }
            });

            await this.apiCall(`/api/classes/${this.currentClassId}/seat-assignments`, {
                method: 'POST',
                body: JSON.stringify({ assignments })
            });

        } catch (error) {
            console.error('Error saving class state:', error);
        }
    }

    async addStudent() {
        if (!this.currentClassId) {
            alert('Bitte wählen Sie zuerst eine Klasse aus.');
            return;
        }

        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const photoFile = document.getElementById('studentPhoto').files[0];

        if (!firstName || !lastName) return;

        try {
            let photo = null;
            if (photoFile) {
                photo = await this.fileToBase64(photoFile);
            }

            if (this.currentEditingStudent) {
                // Update existing student
                const updatedStudent = await this.apiCall(`/api/students/${this.currentEditingStudent.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        firstName,
                        lastName,
                        photo: photo || this.currentEditingStudent.photo,
                        counter: this.currentEditingStudent.counter,
                        seatPosition: this.currentEditingStudent.seatPosition
                    })
                });

                // Update local data
                const studentIndex = this.students.findIndex(s => s.id === this.currentEditingStudent.id);
                if (studentIndex !== -1) {
                    this.students[studentIndex] = {
                        id: updatedStudent.id.toString(),
                        firstName: updatedStudent.first_name,
                        lastName: updatedStudent.last_name,
                        photo: updatedStudent.photo,
                        counter: updatedStudent.counter,
                        seatPosition: updatedStudent.seat_position
                    };
                }
            } else {
                // Add new student
                const newStudent = await this.apiCall(`/api/classes/${this.currentClassId}/students`, {
                    method: 'POST',
                    body: JSON.stringify({
                        firstName,
                        lastName,
                        photo
                    })
                });

                this.students.push({
                    id: newStudent.id.toString(),
                    firstName: newStudent.first_name,
                    lastName: newStudent.last_name,
                    photo: newStudent.photo,
                    counter: 0,
                    seatPosition: null
                });
            }

            this.renderStudentPool();
            document.getElementById('studentModal').style.display = 'none';
            this.clearForm();

        } catch (error) {
            console.error('Error saving student:', error);
            alert('Fehler beim Speichern des Schülers.');
        }
    }

    async deleteCurrentClass() {
        if (!this.currentClassId || this.classes.size <= 1) return;

        const classData = this.classes.get(this.currentClassId);
        if (confirm(`Möchten Sie die Klasse "${classData.name}" wirklich löschen?`)) {
            try {
                await this.apiCall(`/api/classes/${this.currentClassId}`, {
                    method: 'DELETE'
                });

                this.classes.delete(this.currentClassId);
                
                // Switch to first available class
                const firstClassId = this.classes.keys().next().value;
                await this.switchClass(firstClassId);
                this.updateClassSelect();
            } catch (error) {
                console.error('Error deleting class:', error);
                alert('Fehler beim Löschen der Klasse.');
            }
        }
    }

    async deleteCurrentStudent() {
        if (!this.currentEditingStudent) return;

        if (confirm(`Möchten Sie ${this.currentEditingStudent.firstName} ${this.currentEditingStudent.lastName} wirklich löschen?`)) {
            try {
                await this.apiCall(`/api/students/${this.currentEditingStudent.id}`, {
                    method: 'DELETE'
                });

                // Remove from local arrays
                this.students = this.students.filter(s => s.id !== this.currentEditingStudent.id);
                this.studentCounters.delete(this.currentEditingStudent.id);
                this.removeStudentFromSeat(this.currentEditingStudent.id);

                document.getElementById('studentModal').style.display = 'none';
                this.clearForm();
                this.renderStudentPool();
            } catch (error) {
                console.error('Error deleting student:', error);
                alert('Fehler beim Löschen des Schülers.');
            }
        }
    }

    async updateStudentCounter(studentId, counter) {
        const student = this.students.find(s => s.id === studentId);
        if (!student) return;

        try {
            await this.apiCall(`/api/students/${studentId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    firstName: student.firstName,
                    lastName: student.lastName,
                    photo: student.photo,
                    counter: counter,
                    seatPosition: student.seatPosition
                })
            });
        } catch (error) {
            console.error('Error updating student counter:', error);
        }
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // Rest of the methods remain the same...
    createSeats() {
        const grid = document.getElementById('classroomGrid');
        grid.innerHTML = '';
        this.seats = [];

        grid.style.gridTemplateColumns = `repeat(${this.gridColumns}, 1fr)`;
        grid.style.gridTemplateRows = `repeat(${this.gridRows}, 1fr)`;

        const seatCount = this.gridRows * this.gridColumns;

        for (let i = 0; i < seatCount; i++) {
            const seat = document.createElement('div');
            seat.className = 'seat';
            seat.dataset.seatId = i;
            seat.innerHTML = '<span style="color: #8e8e93; font-size: 12px;">Platz ' + (i + 1) + '</span>';

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

        const counter = document.createElement('div');
        counter.className = 'student-counter';
        
        if (this.showGrades) {
            const grade = this.calculateGrade(student.id);
            counter.textContent = grade;
            counter.classList.add('grade-display');
            
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

        card.addEventListener('dragstart', this.handleDragStart.bind(this));
        card.addEventListener('dragend', this.handleDragEnd.bind(this));

        if (this.seats.some(seat => seat.student && seat.student.id === student.id)) {
            card.addEventListener('mousedown', (e) => {
                if (e.target.closest('.student-card-actions')) return;
                e.preventDefault();
                this.handleCounterPress(student.id);
            });

            card.addEventListener('mouseup', (e) => {
                if (e.target.closest('.student-card-actions')) return;
                e.preventDefault();
                this.handleCounterRelease(student.id);
            });

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

            card.draggable = false;
        } else {
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

    assignStudentToSeat(studentId, seatId, save = true) {
        const student = this.students.find(s => s.id == studentId);
        const seat = this.seats[seatId];

        if (!student || !seat) return;

        this.removeStudentFromSeat(studentId);

        if (seat.student) {
            this.removeStudentFromSeat(seat.student.id);
        }

        seat.student = student;
        student.seatPosition = seatId;
        seat.element.innerHTML = '';
        seat.element.classList.add('occupied');

        const studentCard = this.createStudentCard(student);
        seat.element.appendChild(studentCard);

        this.renderStudentPool();
        
        if (save) {
            this.saveCurrentClassState();
        }
    }

    removeStudentFromSeat(studentId) {
        const seat = this.seats.find(s => s.student && s.student.id == studentId);
        if (seat) {
            seat.student.seatPosition = null;
            seat.student = null;
            seat.element.classList.remove('occupied');
            seat.element.innerHTML = `<span style="color: #8e8e93; font-size: 12px;">Platz ${seat.id + 1}</span>`;
        }
        this.renderStudentPool();
    }

    resetAllSeats() {
        this.seats.forEach(seat => {
            if (seat.student) {
                seat.student.seatPosition = null;
            }
            seat.student = null;
            seat.element.classList.remove('occupied');
            seat.element.innerHTML = `<span style="color: #8e8e93; font-size: 12px;">Platz ${seat.id + 1}</span>`;
        });
        this.studentCounters.clear();
        this.renderStudentPool();
        this.saveCurrentClassState();
    }

    resetAllCounters() {
        if (confirm('Möchten Sie wirklich alle Zähler in dieser Klasse zurücksetzen?')) {
            this.studentCounters.clear();
            this.students.forEach(student => {
                student.counter = 0;
                this.updateStudentCounter(student.id, 0);
            });
            this.updateAllCounterDisplays();
            this.renderStudentPool();
        }
    }

    addRow() {
        if (this.hasSeatedStudents()) {
            if (!confirm('Es sind Schüler im Sitzplan platziert. Beim Hinzufügen einer Zeile werden alle Schüler zurück in die Schülerliste verschoben. Möchten Sie fortfahren?')) {
                return;
            }
        }
        
        this.resetAllSeats();
        this.gridRows++;
        this.createSeats();
        this.saveCurrentClassState();
    }

    removeRow() {
        if (this.gridRows <= 1) return;

        if (this.hasSeatedStudents()) {
            if (!confirm('Es sind Schüler im Sitzplan platziert. Beim Entfernen einer Zeile werden alle Schüler zurück in die Schülerliste verschoben. Möchten Sie fortfahren?')) {
                return;
            }
        }

        this.resetAllSeats();
        this.gridRows--;
        this.createSeats();
        this.saveCurrentClassState();
    }

    addColumn() {
        if (this.hasSeatedStudents()) {
            if (!confirm('Es sind Schüler im Sitzplan platziert. Beim Hinzufügen einer Spalte werden alle Schüler zurück in die Schülerliste verschoben. Möchten Sie fortfahren?')) {
                return;
            }
        }
        
        this.resetAllSeats();
        this.gridColumns++;
        this.createSeats();
        this.saveCurrentClassState();
    }

    removeColumn() {
        if (this.gridColumns <= 1) return;

        if (this.hasSeatedStudents()) {
            if (!confirm('Es sind Schüler im Sitzplan platziert. Beim Entfernen einer Spalte werden alle Schüler zurück in die Schülerliste verschoben. Möchten Sie fortfahren?')) {
                return;
            }
        }

        this.resetAllSeats();
        this.gridColumns--;
        this.createSeats();
        this.saveCurrentClassState();
    }

    hasSeatedStudents() {
        return this.seats.some(seat => seat.student !== null);
    }

    editStudent(student) {
        this.currentEditingStudent = student;

        document.getElementById('firstName').value = student.firstName;
        document.getElementById('lastName').value = student.lastName;

        document.getElementById('deleteStudent').style.display = 'inline-block';
        document.getElementById('submitButton').textContent = 'Aktualisieren';
        document.querySelector('.modal-content h3').textContent = 'Schüler bearbeiten';

        document.getElementById('studentModal').style.display = 'block';
    }

    handleCounterPress(studentId) {
        this.isLongPress = false;
        
        this.longPressTimer = setTimeout(() => {
            this.isLongPress = true;
            this.decrementCounter(studentId);
        }, this.longPressDelay);
    }

    handleCounterRelease(studentId) {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        if (!this.isLongPress) {
            this.incrementCounter(studentId);
        }

        this.isLongPress = false;
    }

    incrementCounter(studentId) {
        const currentCount = this.studentCounters.get(studentId) || 0;
        const newCount = currentCount + 1;
        this.studentCounters.set(studentId, newCount);
        
        const student = this.students.find(s => s.id === studentId);
        if (student) {
            student.counter = newCount;
            this.updateStudentCounter(studentId, newCount);
        }
        
        this.updateCounterDisplay(studentId);
    }

    decrementCounter(studentId) {
        const currentCount = this.studentCounters.get(studentId) || 0;
        const newCount = currentCount - 1;
        this.studentCounters.set(studentId, newCount);
        
        const student = this.students.find(s => s.id === studentId);
        if (student) {
            student.counter = newCount;
            this.updateStudentCounter(studentId, newCount);
        }
        
        this.updateCounterDisplay(studentId);
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
        
        this.renderStudentPool();
        this.updateAllCounterDisplays();
        this.saveCurrentClassState();
    }

    setStartingGrade(grade) {
        this.startingGrade = grade;
        this.updateStartingGradeButtons();
        
        if (this.showGrades) {
            this.renderStudentPool();
            this.updateAllCounterDisplays();
        }
        this.saveCurrentClassState();
    }

    calculateGrade(studentId) {
        const counter = this.studentCounters.get(studentId) || 0;
        const grade = this.startingGrade - (counter * 0.5);
        
        const clampedGrade = Math.max(1.0, Math.min(6.0, grade));
        
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

document.addEventListener('DOMContentLoaded', () => {
    new SeatingPlan();
});
