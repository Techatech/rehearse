# Contributing to Rehearse

First off, thank you for considering contributing to Rehearse! It's people like you that make Rehearse such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* Use a clear and descriptive title
* Describe the exact steps which reproduce the problem
* Provide specific examples to demonstrate the steps
* Describe the behavior you observed after following the steps
* Explain which behavior you expected to see instead and why
* Include screenshots if possible

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* Use a clear and descriptive title
* Provide a step-by-step description of the suggested enhancement
* Provide specific examples to demonstrate the steps
* Describe the current behavior and explain the behavior you expected to see instead
* Explain why this enhancement would be useful

### Pull Requests

* Fill in the required template
* Follow the TypeScript styleguide
* Include appropriate test coverage
* Update documentation as needed
* End all files with a newline

## Development Process

1. Fork the repo
2. Create a new branch from `main`
3. Make your changes
4. Ensure tests pass
5. Commit your changes
6. Push to your fork
7. Submit a pull request

### Setting Up Development Environment

```bash
# Clone your fork
git clone https://github.com/your-username/rehearse.git
cd rehearse

# Install dependencies
npm install
cd frontend && npm install && cd ..
cd admin && npm install && cd ..

# Set up environment variables
# (See README.md for details)

# Start development servers
raindrop build start  # Terminal 1
cd frontend && npm run dev  # Terminal 2
cd admin && npm run dev  # Terminal 3
```

### Code Style

* Use TypeScript for all new code
* Follow existing code formatting
* Use meaningful variable names
* Add comments for complex logic
* Keep functions small and focused

### Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

Examples:
```
Add user authentication via WorkOS
Fix interview session timeout issue
Update deployment documentation
```

### Testing

* Write tests for new features
* Ensure all tests pass before submitting PR
* Aim for good test coverage

```bash
npm test
```

## Project Structure

```
frontend/     # User-facing React app
admin/        # Admin dashboard React app
shared/       # Shared types and utilities
src/          # Backend (Raindrop/Cloudflare Workers)
```

## Questions?

Feel free to open an issue with your question or reach out to the maintainers directly.

Thank you for contributing! 🎉
