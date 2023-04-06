const express = require('express');
const app = express();
const port = 3000;
const bodyParser = require('body-parser');
const fs = require('fs');

const StudentVue = require('studentvue.js');

app.use(bodyParser.json());

app.get('/', (req, res) => {
    //login to studentvue
    StudentVue.login('https://mn-mvps-psv.edupoint.com/PXP2_Login_Student.aspx?regenerateSessionId=True', '2025roloa82', 'Drew2007$')
        .then(client => client.getGradebook())
        .then(response => {
            const jsonData = JSON.parse(response);
            const courses = jsonData.Gradebook.Courses.Course;

            // Create an object that contains only the relevant course data
            const courseData = courses.map(course => ({
                title: course.Title,
                marks: Array.isArray(course.Marks.Mark)
                    ? course.Marks.Mark.map(mark => ({
                        measure: mark.Measure,
                        type: mark.Type,
                        score: mark.CalculatedScoreString,
                        points: mark.PointsPossible
                    }))
                    : []
            }));


            // Write the course data to a JSON file
            fs.writeFile('grades.json', response, err => {
                if (err) {
                    console.error(err);
                    return;
                }
                console.log('Grades saved to grades.json');
            });

            // Render the HTML table
            let htmlTable = '<table>';
            htmlTable += '<tr><th>Course Name</th><th>Grade</th></tr>';
            courses.forEach(course => {
                const courseName = course.Title;


                //checks if 'Mark' is an array
                let marks = course.Marks.Mark;
                if (!Array.isArray(marks)) {
                    marks = [marks];
                }
                //maps 'marks' variable, names it 'grades'
                const grades = marks.map(mark => mark.CalculatedScoreString).join(', ');
                htmlTable += `<tr><td><a href="/course?id=${courseName}">${courseName}</a></td><td>${grades}</td></tr>`;
            });
            htmlTable += '</table>';

            // Read the template file
            fs.readFile('template.html', 'utf8', function (err, data) {
                if (err) {
                    console.log(err);
                    res.status(500).send('Error reading template file');
                }
                // Replace the placeholder with the table HTML string
                const outputHtml = data.replace('<div id="table-placeholder"></div>', htmlTable);

                // Send the output HTML to the client
                res.send(outputHtml);
            });
        })
        .catch(error => {
            console.error(error);
            res.send('Error occurred: ' + error.message);
        });

});

app.get('/course', (req, res) => {
    const courseId = req.query.id;

    fs.readFile('./public/settings.json', (err, settings) => {
        const settingsData = JSON.parse(settings);
        console.log(settingsData);
        const doGradeBreakdown = settingsData.doGradeBreakdown;
        const doGradebookID = settingsData.doGradebookID;
        const doAssignmentDate = settingsData.doAssignmentDate;
        const doAssignmentDueDate = settingsData.doAssignmentDueDate;
        console.log(doGradeBreakdown);

        fs.readFile('grades.json', (err, data) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error reading grades file');
                return;
            }

            const jsonData = JSON.parse(data);
            const course = jsonData.Gradebook.Courses.Course.find(c => c.Title === courseId);
            if (!course) {
                res.status(404).send(`Course '${courseId}' not found`);
                return;
            }

            const assignments = course.Marks.Mark.Assignments.Assignment;
            if (assignments.length === 0) {
                res.status(404).send(`There are no current assignments for course '${courseId}'`);
                return;
            }

            const breakdowncalc = course.Marks.Mark.GradeCalculationSummary.AssignmentGradeCalc;
            if (assignments.length === 0) {
                res.send('Error doing breakdowncalc');
                return;
            }

            // Read the course template file
            fs.readFile('course_template.html', 'utf8', function (err, data) {
                if (err) {
                    console.error(err);
                    res.status(500).send('Error reading course template file');
                    return;
                }

                // Replace the placeholders with the course details
                let outputHtml = data.replace('${courseName}', courseId)
                    .replace('${courseName1}', 'Grades for ' + courseId);

                //gradebreakdown
                if (doGradeBreakdown) {
                    outputHtml += '<div class="BreakdownBorder">';
                    if (breakdowncalc != undefined) {
                        breakdowncalc.forEach((breakdowncalc) => {
                            const btype = breakdowncalc.Type;
                            const bmark = breakdowncalc.CalculatedMark;

                            //Breakdown of grade HTML
                            const breakdownHtml = `
                    <div class="GradeBreakdown">
                        <h3>Overall ${btype} Grade:</h3>
                        <p>${bmark}</p>
                    </div>
                    `;

                            outputHtml += breakdownHtml;


                        });
                    };
                    outputHtml += '</div>';
                }
                // Add each assignment to the output HTML
                assignments.forEach((assignment) => {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    const measure = assignment.Measure;
                    const type = assignment.Type;
                    const score = assignment.Score;
                    const points = assignment.Points;
                    const date = assignment.Date;
                    const duedate = assignment.DueDate;


                    const gradeid = assignment.GradebookID;
                    let gradeIDHtml = `<p><strong>Assignment ID:</strong> ${gradeid}</p>`;
                    let dateHtml = `<p><strong>Assignment Date:</strong> ${date}</p>`;
                    let dueDateHtml = `<p><strong>Assignment Due Date:</strong> ${duedate}</p>`;

                    if (doGradebookID) {
                        gradeIDHtml = `<p><strong>Assignment ID:</strong> ${gradeid}</p>`;
                    } else {
                        gradeIDHtml = ''
                    }
                    if (doAssignmentDate) {
                        dateHtml = `<p><strong>Assignment Date:</strong> ${date}</p>`;
                    } else {
                        dateHtml = '';
                    }
                    if (doAssignmentDueDate) {
                        dueDateHtml = `<p><strong>Assignment Due Date:</strong> ${duedate}</p>`;
                    } else {
                        dueDateHtml = '';
                    }

                    // Create the HTML elements for the assignment
                    const assignmentHtml = `
                    <div class="assignmentborder">
                        <div class="assignment">
                            ${dateHtml}
                            <p><strong>Assignment Name:</strong> ${measure}</p>
                            ${dueDateHtml}
                            <p><strong>Assignment Type:</strong> ${type}</p>
                            ${gradeIDHtml}
                            <p><strong>Score:</strong> ${score}</p>
                            <p><strong>Points:</strong> ${points}</p>
                        </div>
                    </div>
                  `;
                    // Append the assignment HTML to the output HTML
                    outputHtml += assignmentHtml;




                });

                // Send the output HTML to the client
                res.send(outputHtml);
            });
        });
    });
});

app.get('/settings', (req, res) => {
    fs.readFile('settings.html', 'utf8', function (err, data) {
        if (err) {
            console.error(err);
            res.status(500).send('Error reading settings.html file');
            return;
        }
        let outputHtml = data;

        res.send(outputHtml);


    });
});

app.post('/submit', (req, res) => {
    const { isChecked1, isChecked2, isChecked3, isChecked4 } = req.body;

    const updatedSettings = {
        doGradeBreakdown: isChecked1 || false,
        doGradebookID: isChecked2 || false,
        doAssignmentDate: isChecked3 || false,
        doAssignmentDueDate: isChecked4 || false,
    };
    const updatedSettingsJSON = JSON.stringify(updatedSettings);
    fs.writeFile('./public/settings.json', updatedSettingsJSON, (err) => {
        if (err) {
            console.error(err);
            res.status(500).send('Failed to update settings');
        } else {
            console.log('Settings updated successfully');
            res.sendStatus(200);
        }
    });
});



app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});

app.use(express.static('public'));