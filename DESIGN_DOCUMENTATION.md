# System Design Documentation
## Project: In-Class Student Companion App

**Version:** 1.0
**Date:** March 8, 2026

---

## 1. System Architecture

The **In-Class** app follows a serverless architecture using **Firebase** as the backend-as-a-service (BaaS) and **React Native (via Capacitor)** for the frontend client.

### 1.1 High-Level Architecture Diagram
```mermaid
graph TD
    Client[Mobile App (React + Capacitor)]
    Auth[Firebase Authentication]
    DB[Firestore Database]
    Storage[Firebase Storage]
    
    Client -->|Authenticates| Auth
    Client -->|Reads/Writes Data| DB
    Client -->|Uploads/Downloads Files| Storage
    
    subgraph Backend Services
        Auth
        DB
        Storage
    end
```

---

## 2. Data Design

### 2.1 Entity Relationship Diagram (ERD)

The following diagram illustrates the relationships between the core entities in the Firestore database.

```mermaid
erDiagram
    %% Relationships
    USER ||--o{ GROUP : "creates (Faculty)"
    USER }|--|{ GROUP : "enrolls in (Student)"
    GROUP ||--o{ NOTE : "contains"
    GROUP ||--o{ DEADLINE : "schedules"
    GROUP ||--o{ ATTENDANCE_SESSION : "hosts"
    ATTENDANCE_SESSION ||--o{ ATTENDANCE_RECORD : "logs"
    USER ||--o{ ATTENDANCE_RECORD : "submits"
    USER ||--o{ MARKS : "receives"
    GROUP ||--o{ MARKS : "records"

    %% Entities
    USER {
        string uid PK
        string email
        string name
        string role "student | faculty"
        string studentId "Optional"
    }

    GROUP {
        string groupId PK
        string name
        string facultyId FK
        string[] studentIds
        string driveFolderUrl "Class GDrive Folder"
        datetime createdAt
    }

    NOTE {
        string noteId PK
        string groupId FK
        string title
        string content
        string[] driveFileUrls "GDrive File Links"
        string facultyId FK
        datetime createdAt
    }

    DEADLINE {
        string deadlineId PK
        string groupId FK
        string title
        string description
        datetime dueDate
        string type
    }

    ATTENDANCE_SESSION {
        string sessionId PK
        string groupId FK
        string code
        datetime expiresAt
        string facultyId FK
    }

    ATTENDANCE_RECORD {
        string recordId PK
        string sessionId FK
        string studentId FK
        string groupId FK
        datetime timestamp
    }

    MARKS {
        string markId PK
        string studentId FK
        string groupId FK
        string subject
        number test1
        number test2
        number test3
        number average
    }
```

### 2.2 Cardinality and Relationships

*   **USER (Faculty) `1 : N` GROUP**: A single faculty member can create and manage multiple groups (classes), but each group is created by exactly one faculty member.
*   **USER (Student) `M : N` GROUP**: A student can enroll in multiple groups, and each group can contain multiple students. *(Note: In Firestore, this is modeled using an array of `studentIds` inside the Group document).*
*   **GROUP `1 : N` NOTE**: A group can contain multiple notes or announcements, but a specific note belongs to exactly one group.
*   **GROUP `1 : N` DEADLINE**: A group can have multiple scheduled deadlines (assignments/exams), but each deadline belongs to exactly one group.
*   **GROUP `1 : N` ATTENDANCE_SESSION**: A group can host multiple attendance sessions over the semester, but each session is tied to exactly one group.
*   **ATTENDANCE_SESSION `1 : N` ATTENDANCE_RECORD**: A single attendance session will log multiple attendance records (one for each present student), but a single record belongs to exactly one session.
*   **USER (Student) `1 : N` ATTENDANCE_RECORD**: A student can submit multiple attendance records over time across different sessions, but each record belongs to exactly one student.
*   **USER (Student) `1 : N` MARKS**: A student can receive multiple mark records (for different groups/subjects), but a specific mark record belongs to exactly one student.
*   **GROUP `1 : N` MARKS**: A group will record multiple marks (one for each student enrolled), but a specific mark record belongs to exactly one group.

### 2.3 Data Dictionary

#### **User** (`/users/{uid}`)
| Field | Type | Description |
|---|---|---|
| `uid` | String | Unique Identifier (Primary Key) |
| `email` | String | User's email address |
| `name` | String | Full name of the user |
| `role` | String | 'student' or 'faculty' |
| `studentId` | String | (Optional) Roll number or ID for students |

#### **Group** (`/groups/{groupId}`)
| Field | Type | Description |
|---|---|---|
| `groupId` | String | Unique Identifier (Primary Key) |
| `name` | String | Name of the class/subject |
| `facultyId` | String | UID of the faculty who created the group (Foreign Key) |
| `studentIds` | Array<String> | List of UIDs of enrolled students |
| `createdAt` | Timestamp | Creation date |

#### **Note** (`/notes/{noteId}`)
| Field | Type | Description |
|---|---|---|
| `noteId` | String | Unique Identifier (Primary Key) |
| `groupId` | String | ID of the group this note belongs to (Foreign Key) |
| `title` | String | Title of the note |
| `content` | String | Body text/description |
| `attachments` | Array<String> | List of secure download URLs for the uploaded files |
| `facultyId` | String | UID of the faculty author (Foreign Key) |
| `createdAt` | Timestamp | Creation date |

#### **Deadline** (`/deadlines/{deadlineId}`)
| Field | Type | Description |
|---|---|---|
| `deadlineId` | String | Unique Identifier (Primary Key) |
| `groupId` | String | ID of the group (Foreign Key) |
| `title` | String | Title of the assignment/exam |
| `description` | String | Details of the deadline |
| `dueDate` | Timestamp | Date and time when it is due |
| `type` | String | 'assignment' or 'experiment' |

#### **AttendanceSession** (`/attendanceSessions/{sessionId}`)
| Field | Type | Description |
|---|---|---|
| `sessionId` | String | Unique Identifier (Primary Key) |
| `groupId` | String | ID of the group (Foreign Key) |
| `code` | String | 6-digit code for marking attendance |
| `expiresAt` | Timestamp | Time when the code becomes invalid |
| `facultyId` | String | UID of the faculty who started it (Foreign Key) |

#### **AttendanceRecord** (`/attendanceRecords/{recordId}`)
| Field | Type | Description |
|---|---|---|
| `recordId` | String | Unique Identifier (Primary Key) |
| `sessionId` | String | ID of the session attended (Foreign Key) |
| `studentId` | String | ID of the student (Foreign Key) |
| `groupId` | String | ID of the group (Foreign Key) |
| `timestamp` | Timestamp | Time when attendance was marked |

#### **Marks** (`/marks/{markId}`)
| Field | Type | Description |
|---|---|---|
| `markId` | String | Unique Identifier (Primary Key) |
| `studentId` | String | ID of the student (Foreign Key) |
| `groupId` | String | ID of the group (Foreign Key) |
| `subject` | String | Name of the subject |
| `test1` | Number | Score for Test 1 |
| `test2` | Number | Score for Test 2 |
| `test3` | Number | Score for Test 3 |
| `average` | Number | Calculated average of best two scores |

### 2.3 Class Diagram

The following diagram represents the software classes and their methods, mirroring the data entities but focusing on application logic.

```mermaid
classDiagram
    class User {
        +String uid
        +String email
        +String name
        +String role
        +login()
        +logout()
        +updateProfile()
    }

    class Student {
        +String studentId
        +joinGroup(code)
        +markAttendance(sessionCode)
        +viewMarks()
        +viewDeadlines()
    }

    class Faculty {
        +createGroup(name)
        +postNote(groupId, content)
        +createDeadline(groupId, date)
        +startAttendanceSession(groupId)
        +updateMarks(studentId, scores)
    }

    class Group {
        +String groupId
        +String name
        +String facultyId
        +List~String~ studentIds
        +addStudent(studentId)
        +removeStudent(studentId)
        +getDetails()
    }

    class Note {
        +String noteId
        +String title
        +String content
        +List~Attachment~ attachments
        +downloadAttachment()
    }

    class Deadline {
        +String deadlineId
        +String title
        +Date dueDate
        +String type
        +isOverdue()
    }

    class AttendanceSession {
        +String sessionId
        +String code
        +Date expiresAt
        +isValid()
        +closeSession()
    }

    class Marks {
        +String markId
        +Number test1
        +Number test2
        +Number test3
        +Number average
        +calculateAverage()
    }

    User <|-- Student
    User <|-- Faculty
    Faculty "1" --> "*" Group : manages
    Student "*" --> "*" Group : enrolled in
    Group "1" *-- "*" Note : contains
    Group "1" *-- "*" Deadline : has
    Group "1" *-- "*" AttendanceSession : hosts
    Student "1" --> "*" AttendanceSession : attends
    Student "1" --> "*" Marks : has
    Group "1" --> "*" Marks : records
```

---

## 3. Security Design

### 3.1 Authentication
- **Provider:** Firebase Authentication (Email/Password).
- **Session Management:** handled by Firebase SDK (persistent tokens).

### 3.2 Authorization (Firestore Rules)
- **Users:** Can read their own profile.
- **Groups:**
    - Faculty can create/update their own groups.
    - Students can read groups they are a member of (`studentIds` array).
- **Notes/Deadlines:**
    - Faculty can write to groups they own.
    - Students can read from groups they are members of.
- **Attendance:**
    - Faculty can create sessions.
    - Students can create records (mark attendance) only if the session is active and they are in the group.
- **Marks:**
    - Faculty can write marks.
    - Students can read only their own marks.

---

## 4. Data Flow Diagrams (DFD)

### 4.1 DFD Level 0 (Context Diagram)
The Level 0 DFD provides a high-level overview of the entire system, showing how external entities (Student and Faculty) interact with the core application.

```mermaid
flowchart TD
    %% External Entities
    Student((Student))
    Faculty((Faculty))
    
    %% System
    System[0.0 In-Class Student Companion System]
    
    %% Data Flows
    Student -- "Login Credentials, Attendance Code" --> System
    System -- "Notes, Deadlines, Marks, Attendance Status" --> Student
    
    Faculty -- "Login Credentials, Session Codes, Notes, Deadlines, Marks" --> System
    System -- "Attendance Reports, Class Data" --> Faculty
```

### 4.2 DFD Level 1
The Level 1 DFD breaks down the main system into its primary sub-processes, mapping the flow of data between the external entities, the core processes, and the database storage (Data Stores).

```mermaid
flowchart TD
    %% External Entities
    Student((Student))
    Faculty((Faculty))
    
    %% Processes (Verb-Noun format)
    P1(1.0 Manage Authentication)
    P2(2.0 Manage Groups)
    P3(3.0 Process Attendance)
    P4(4.0 Manage Content)
    P5(5.0 Process Marks)
    
    %% Data Stores
    D1[(D1: Users)]
    D2[(D2: Groups)]
    D3[(D3: Attendance Records)]
    D4[(D4: Course Content)]
    D5[(D5: Marks)]
    
    %% Flows for Authentication
    Student -- "Credentials" --> P1
    Faculty -- "Credentials" --> P1
    P1 -- "User Data" --> D1
    D1 -- "Auth Status & Profile" --> P1
    P1 -- "Profile Info" --> Student
    P1 -- "Profile Info" --> Faculty
    
    %% Flows for Group Management
    Faculty -- "Create/Manage Groups" --> P2
    P2 -- "Group Data" --> D2
    D2 -- "Enrolled Groups" --> P2
    P2 -- "Class List" --> Student
    
    %% Flows for Attendance
    Faculty -- "Generate Session Code" --> P3
    Student -- "Submit Session Code" --> P3
    P3 -- "Session & Record Data" --> D3
    D3 -- "Attendance History" --> P3
    D2 -. "Verify Enrollment" .-> P3
    P3 -- "Attendance Status" --> Student
    P3 -- "Attendance Reports" --> Faculty
    
    %% Flows for Content (Notes/Deadlines)
    Faculty -- "Upload Notes & Deadlines" --> P4
    P4 -- "Content Data" --> D4
    D4 -- "Notes & Deadlines" --> P4
    D2 -. "Verify Group" .-> P4
    P4 -- "Class Materials" --> Student
    
    %% Flows for Marks
    Faculty -- "Input Marks" --> P5
    P5 -- "Marks Data" --> D5
    D5 -- "Scores" --> P5
    D2 -. "Verify Group" .-> P5
    P5 -- "Scorecard & Average" --> Student
```

---

## 5. Use Case and Activity Diagrams

### 5.1 Use Case Diagram
The Use Case Diagram illustrates the interactions between the primary actors (Student and Faculty) and the system's core functionalities.

```mermaid
flowchart LR
    %% Actors
    Student([Student])
    Faculty([Faculty])
    
    %% System Boundary
    subgraph System [In-Class Student Companion App]
        direction TB
        UC1(Login / Auth)
        UC2(Join Class Group)
        UC3(Create/Manage Class Group)
        UC4(Mark Attendance)
        UC5(Generate Session Code)
        UC6(View/Download Notes)
        UC7(Upload Notes & Deadlines)
        UC8(View Marks)
        UC9(Input Marks)
    end
    
    %% Relationships
    Student --- UC1
    Student --- UC2
    Student --- UC4
    Student --- UC6
    Student --- UC8
    
    Faculty --- UC1
    Faculty --- UC3
    Faculty --- UC5
    Faculty --- UC7
    Faculty --- UC9
```

### 5.2 Activity Diagram (Mark Attendance Process)
The Activity Diagram details the step-by-step flow of the most critical process in the application: Marking Attendance. It shows the sequence of actions from the Faculty generating the code to the Student submitting it, including system validations.

```mermaid
flowchart TD
    %% Start
    Start((Start)) --> F1[Faculty creates Attendance Session]
    
    %% Faculty Flow
    F1 --> F2[System generates 6-digit code]
    F2 --> F3[Faculty shares code with class]
    
    %% Student Flow
    F3 --> S1[Student opens Attendance Module]
    S1 --> S2[Student enters 6-digit code]
    
    %% Validation Flow
    S2 --> V1{Is Code Valid & Active?}
    
    V1 -- No --> E1[Show 'Invalid Code' Error]
    E1 --> S2
    
    V1 -- Yes --> V2{Is Student Enrolled?}
    
    V2 -- No --> E2[Show 'Not Enrolled' Error]
    E2 --> End((End))
    
    V2 -- Yes --> V3{Already Marked?}
    
    V3 -- Yes --> E3[Show 'Already Marked' Info]
    E3 --> End
    
    V3 -- No --> R1[System logs Attendance Record]
    R1 --> S3[Show Success Message]
    S3 --> End
```
