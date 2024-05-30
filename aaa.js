const vscode = require("vscode");
const axios = require("axios");
const { MongoClient } = require("mongodb");
const https = require("https");
const { parse, walk } = require("abstract-syntax-tree");

// Configuration constants
const CLIENT_ID = "619571dea96f6fc0bbbf";
const REDIRECT_URI = "https://github.com/";
const MONGO_URI = "mongodb://localhost:27017/DBconnect";

// Utility httpsAgent configuration to ignore self-signed certs (development purposes only)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

// Axios Configuration
axios.defaults.httpsAgent = httpsAgent;

// Function to save user data to MongoDB
async function saveUserData(userData) {
    const client = new MongoClient(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    try {
        await client.connect();
        const database = client.db("githubAuth");
        const collection = database.collection("users");
        await collection.insertOne(userData);
        console.log("User data saved to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    } finally {
        await client.close();
    }
}

function analyzeVariableDeclarations(ast) {
    const issues = [];

    walk(ast, function (node) {
        if (node.type === 'VariableDeclaration' && node.kind === 'var') {
            let shouldChangeToLet = false;

            // Check for reassignment of the variable in the AST
            ast.body.forEach(statement => {
                walk(statement, function (n) { // Change the emoji to 'n'
                    if (n.type === 'AssignmentExpression' && n.left.type === 'Identifier') {
                        const identifier = n.left.name;
                        if (node.declarations.some(declaration => declaration.id.name === identifier)) {
                            shouldChangeToLet = true;
                        }
                    }
                });
            });

            issues.push({
                line: node.loc.start.line,
                message: shouldChangeToLet ?
                    "Consider using 'let' instead of 'var' here due to reassignment." :
                    "Consider using 'const' instead of 'var' here."
            });
        }
    });

    return issues;
}

function activate(context) {
    console.log('Congratulations, your extension "code-analyzer" is now active!');

    let githubLogin = vscode.commands.registerCommand(
        "extension.githubLogin",
        async function () {
            const githubUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=user`;

            vscode.env.openExternal(vscode.Uri.parse(githubUrl));
            vscode.window.showInformationMessage("GitHub authentication initiated.");

            // Simulate handling OAuth2 callback
            // This should be handled on your backend and not in VS Code
            axios
                .get("https://github.com/")
                .then((response) => {
                    const userData = {
                        login: response.data.login,
                        avatar_url: response.data.avatar_url,
                        organizationsUrl: response.data.organizationsUrl,
                        reposUrl: response.data.reposUrl,
                        profileUrl: response.data.profileUrl,
                        accessToken: response.data.accessToken,
                    };
                    saveUserData(userData);
                    console.log("GitHub user authenticated and data saved");
                })
                .catch((error) => {
                    console.error("Error during GitHub callback handling:", error);
                });
        }
    );

    let scanDocument = vscode.commands.registerCommand("extension.scanDocument", async function () {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            let document = editor.document;
            const documentText = document.getText();
            console.log("Active document content:", documentText);

            try {
                if (!documentText) {
                    vscode.window.showErrorMessage("The active document is empty.");
                    return;
                }

                const ast = parse(documentText);
                console.log("Original AST:", JSON.stringify(ast, null, 2));

                const issues = analyzeVariableDeclarations(ast);
                console.log("Detected issues:", issues);

                issues.forEach(issue => {
                    let logMessage = `Line ${issue.line}: ${issue.message}`;
                    console.log(logMessage);
                    vscode.window.showInformationMessage(logMessage);
                });

                vscode.window.showInformationMessage("AST analysis complete. Check the console for details.");
            } catch (error) {
                console.error("Error parsing document text to AST:", error);
                vscode.window.showErrorMessage("Error occurred during AST analysis. Check the console for details.");
            }
        } else {
            vscode.window.showErrorMessage("No active editor found.");
        }
    });

    context.subscriptions.push(githubLogin, scanDocument);
}

function deactivate() { }

module.exports = {
    activate,
    deactivate,
}
