
class SeatingPlan {
    constructor() {
        this.students = [];
        this.seats = [];
        this.draggedElement = null;
        this.gridRows = 5;
        this.gridColumns = 6;
        this.currentEditingStudent = null;
        this.init();
    }

    init() {
        this.createSeats();
        this.bindEvents();
        this.loadSampleData();
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
            this.resetAllSeats();
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

        // Close modal on background click
        document.getElementById('studentModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                document.getElementById('studentModal').style.display = 'none';
                this.clearForm();
            }
        });
    }

    loadSampleData() {
        const sampleStudents = [
            { firstName: 'Max', lastName: 'Mustermann' },
            { firstName: 'Anna', lastName: 'Schmidt' },
            { firstName: 'Tom', lastName: 'Weber' },
            { firstName: 'Lisa', lastName: 'Mueller' },
            { firstName: 'Paul', lastName: 'Wagner' }
        ];

        sampleStudents.forEach(student => {
            this.students.push({
                id: Date.now() + Math.random(),
                firstName: student.firstName,
                lastName: student.lastName,
                photo: null
            });
        });

        this.renderStudentPool();
    }

    addStudent() {
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
                };
                reader.readAsDataURL(photoFile);
            } else {
                this.updateStudentEverywhere(student);
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
                };
                reader.readAsDataURL(photoFile);
            } else {
                this.students.push(student);
                this.renderStudentPool();
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

        // Add drag events
        card.addEventListener('dragstart', this.handleDragStart.bind(this));
        card.addEventListener('dragend', this.handleDragEnd.bind(this));

        // Double click to remove from seat
        card.addEventListener('dblclick', () => {
            this.removeStudentFromSeat(student.id);
        });

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
        this.renderStudentPool();
    }

    addRow() {
        // Move all students back to pool before changing grid
        this.resetAllSeats();
        this.gridRows++;
        this.createSeats();
    }

    removeRow() {
        if (this.gridRows <= 1) return;
        
        // Move all students back to pool before changing grid
        this.resetAllSeats();
        this.gridRows--;
        this.createSeats();
    }

    addColumn() {
        // Move all students back to pool before changing grid
        this.resetAllSeats();
        this.gridColumns++;
        this.createSeats();
    }

    removeColumn() {
        if (this.gridColumns <= 1) return;
        
        // Move all students back to pool before changing grid
        this.resetAllSeats();
        this.gridColumns--;
        this.createSeats();
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
        
        if (confirm(`Möchten Sie ${this.currentEditingStudent.firstName} ${this.currentEditingStudent.lastName} wirklich löschen?`)) {
            // Remove from students array
            this.students = this.students.filter(s => s.id !== this.currentEditingStudent.id);
            
            // Remove from any seat
            this.removeStudentFromSeat(this.currentEditingStudent.id);
            
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
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new SeatingPlan();
});
