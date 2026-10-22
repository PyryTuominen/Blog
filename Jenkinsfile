pipeline {
    agent any
    environment {
        IMAGE   = 'blog:latest'
        APP_URL = 'http://localhost:3000'
    }
    parameters {
        // Leave off until the nvd-update job has finished downloading the NVD database
        booleanParam(name: 'RUN_DEPENDENCY_CHECK', defaultValue: false, description: 'Run OWASP Dependency-Check (needs the NVD database from the nvd-update job)')
    }
    stages {
        // Unit tests run first so broken code never gets built or deployed
        stage('Unit Tests') {
            steps {
                sh 'docker run --rm -u $(id -u):$(id -g) -e HOME=/tmp -v "$WORKSPACE":/app -w /app node:20 sh -c "npm ci && npm test"'
            }
        }

        // SCA: scans the source's npm dependencies against the NVD before anything is built.
        // The NVD database is kept fresh by the separate nvd-update job, so the scan runs offline.
        stage('Dependency-Check') {
            when { expression { params.RUN_DEPENDENCY_CHECK } }
            steps {
                catchError(buildResult: 'UNSTABLE', stageResult: 'FAILURE') {
                    timeout(time: 10, unit: 'MINUTES') {
                        dependencyCheck odcInstallation: 'DC',
                            additionalArguments: '--scan . --format XML --format HTML --noupdate --disableYarnAudit --disablePnpmAudit'
                        dependencyCheckPublisher pattern: 'dependency-check-report.xml'
                    }
                }
            }
        }

        stage('Build') {
            steps {
                sh 'docker build --pull --rm -f Dockerfile -t $IMAGE .'
            }
        }

        // Container scan: OS packages and libraries inside the built image
        stage('Trivy') {
            steps {
                sh '''
                    docker run --rm \
                      -v /var/run/docker.sock:/var/run/docker.sock \
                      -v trivy-cache:/root/.cache/ \
                      aquasec/trivy:0.58.1 image --severity HIGH,CRITICAL --exit-code 0 $IMAGE
                '''
            }
        }

        stage('Run') {
            steps {
                sh 'docker rm -f blog || true'
                sh 'docker run -d -p 3000:3000 --name blog $IMAGE'
                sh 'sleep 5'
            }
        }

        // DAST: attacks the running web app from the outside
        stage('Nikto') {
            steps {
                sh 'docker run --rm --network host ghcr.io/sullo/nikto:2.6.1 -h $APP_URL -maxtime 5m || true'
            }
        }
    }
}
