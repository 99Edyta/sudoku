(() => {
      const boardElement = document.getElementById("board");
      const numberElement = document.getElementById("numbers");
      const timerElement = document.getElementById("timer");
      const mistakesElement = document.getElementById("mistakes");
      const messageElement = document.getElementById("message");
      const difficultyElement = document.getElementById("difficulty");
      const notesButton = document.getElementById("notesButton");
      const overlay = document.getElementById("overlay");
      const installButton = document.getElementById("installButton");
      const solution = Array.from({ length: 9 }, () => Array(9).fill(0));
      const puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));
      const entries = Array.from({ length: 9 }, () => Array(9).fill(0));
      const notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
      let selected = null;
      let noteMode = false;
      let mistakes = 0;
      let seconds = 0;
      let started = false;
      let finished = false;
      let timerInterval = null;
      let installPrompt = null;
      const isSecureOrigin = location.protocol === "https:" ||
        ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

      window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();
        installPrompt = event;
      });

      window.addEventListener("appinstalled", () => {
        installPrompt = null;
        installButton.hidden = true;
        setMessage("Sudoku er installeret på din telefon.", "success");
      });

      installButton.addEventListener("click", async () => {
        if (!installPrompt) {
          if (!isSecureOrigin) {
            setMessage("For at installere appen skal den åbnes fra en sikker HTTPS-adresse.");
            return;
          }
          setMessage("Brug browserens menu: “Føj til hjemmeskærm” eller “Installer app”.");
          return;
        }
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
      });

      if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true) {
        installButton.hidden = true;
      }

      if ("serviceWorker" in navigator && isSecureOrigin) {
        navigator.serviceWorker.register("./sw.js").catch(error => {
          console.error("Sudoku kunne ikke klargøre offline-appen:", error);
        });
      }

      function shuffled(values) {
        const result = [...values];
        for (let i = result.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
      }

      function candidates(grid, row, col) {
        const used = new Set();
        for (let i = 0; i < 9; i++) {
          used.add(grid[row][i]);
          used.add(grid[i][col]);
        }
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let r = boxRow; r < boxRow + 3; r++) {
          for (let c = boxCol; c < boxCol + 3; c++) used.add(grid[r][c]);
        }
        return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(number => !used.has(number));
      }

      function fillGrid(grid) {
        let target = null;
        let options = null;
        for (let row = 0; row < 9; row++) {
          for (let col = 0; col < 9; col++) {
            if (grid[row][col] !== 0) continue;
            const available = candidates(grid, row, col);
            if (!options || available.length < options.length) {
              target = [row, col];
              options = available;
            }
          }
        }
        if (!target) return true;
        const [row, col] = target;
        for (const number of shuffled(options)) {
          grid[row][col] = number;
          if (fillGrid(grid)) return true;
        }
        grid[row][col] = 0;
        return false;
      }

      function countSolutions(grid, limit = 2) {
        let target = null;
        let options = null;
        for (let row = 0; row < 9; row++) {
          for (let col = 0; col < 9; col++) {
            if (grid[row][col] !== 0) continue;
            const available = candidates(grid, row, col);
            if (available.length === 0) return 0;
            if (!options || available.length < options.length) {
              target = [row, col];
              options = available;
            }
          }
        }
        if (!target) return 1;
        const [row, col] = target;
        let count = 0;
        for (const number of options) {
          grid[row][col] = number;
          count += countSolutions(grid, limit - count);
          grid[row][col] = 0;
          if (count >= limit) return count;
        }
        return count;
      }

      function generatePuzzle() {
        const fullGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
        fillGrid(fullGrid);
        for (let row = 0; row < 9; row++) {
          for (let col = 0; col < 9; col++) solution[row][col] = fullGrid[row][col];
        }
        const clues = { easy: 40, medium: 33, hard: 28 }[difficultyElement.value];
        const positions = shuffled(Array.from({ length: 81 }, (_, index) => index));
        let removed = 0;
        for (const position of positions) {
          if (removed >= 81 - clues) break;
          const row = Math.floor(position / 9);
          const col = position % 9;
          const value = fullGrid[row][col];
          fullGrid[row][col] = 0;
          const copy = fullGrid.map(line => [...line]);
          if (countSolutions(copy) === 1) removed++;
          else fullGrid[row][col] = value;
        }
        for (let row = 0; row < 9; row++) {
          for (let col = 0; col < 9; col++) puzzle[row][col] = fullGrid[row][col];
        }
      }

      function drawBoard() {
        boardElement.replaceChildren();
        for (let row = 0; row < 9; row++) {
          for (let col = 0; col < 9; col++) {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "cell";
            cell.setAttribute("role", "gridcell");
            cell.dataset.row = row;
            cell.dataset.col = col;
            if (puzzle[row][col]) cell.classList.add("given");
            cell.addEventListener("click", () => {
              selected = [row, col];
              render();
              cell.focus();
            });
            boardElement.append(cell);
          }
        }
        render();
      }

      function render() {
        const cells = boardElement.children;
        const selectedValue = selected ? (entries[selected[0]][selected[1]] || puzzle[selected[0]][selected[1]]) : 0;
        for (let index = 0; index < 81; index++) {
          const row = Math.floor(index / 9);
          const col = index % 9;
          const cell = cells[index];
          const value = puzzle[row][col] || entries[row][col];
          cell.classList.toggle("selected", !!selected && selected[0] === row && selected[1] === col);
          cell.classList.toggle("related", !!selected && (selected[0] === row || selected[1] === col ||
            (Math.floor(selected[0] / 3) === Math.floor(row / 3) && Math.floor(selected[1] / 3) === Math.floor(col / 3))));
          cell.classList.toggle("same-number", !!selectedValue && value === selectedValue && !(selected && selected[0] === row && selected[1] === col));
          cell.classList.toggle("error", !!entries[row][col] && entries[row][col] !== solution[row][col]);
          cell.setAttribute("aria-label", `Række ${row + 1}, kolonne ${col + 1}${value ? `, ${value}` : ", tom"}${puzzle[row][col] ? ", låst" : ""}`);
          cell.replaceChildren();
          if (value) {
            cell.textContent = value;
          } else if (notes[row][col].size) {
            const noteGrid = document.createElement("span");
            noteGrid.className = "notes-grid";
            for (let number = 1; number <= 9; number++) {
              const note = document.createElement("span");
              note.textContent = notes[row][col].has(number) ? number : "";
              noteGrid.append(note);
            }
            cell.append(noteGrid);
          }
        }
        const counts = Array(10).fill(0);
        for (let row = 0; row < 9; row++) {
          for (let col = 0; col < 9; col++) counts[puzzle[row][col] || entries[row][col]]++;
        }
        for (let number = 1; number <= 9; number++) {
          const button = numberElement.children[number - 1];
          button.disabled = counts[number] === 9 || finished;
        }
      }

      function beginTimer() {
        if (started || finished) return;
        started = true;
        timerInterval = setInterval(() => {
          seconds++;
          timerElement.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
        }, 1000);
      }

      function setMessage(text, kind = "") {
        messageElement.textContent = text;
        messageElement.className = `message ${kind}`.trim();
      }

      function placeNumber(number) {
        if (!selected || finished) {
          if (!finished) setMessage("Vælg et felt først.");
          return;
        }
        const [row, col] = selected;
        if (puzzle[row][col]) return;
        beginTimer();
        if (noteMode) {
          if (entries[row][col]) return;
          if (notes[row][col].has(number)) notes[row][col].delete(number);
          else notes[row][col].add(number);
          setMessage("Noten er opdateret.");
        } else {
          notes[row][col].clear();
          if (solution[row][col] !== number) {
            mistakes++;
            mistakesElement.textContent = `${mistakes} / 3`;
            if (mistakes >= 3) {
              entries[row][col] = number;
              render();
              finishGame(false);
              return;
            }
            entries[row][col] = number;
            setMessage("Ikke helt — prøv igen!", "error-text");
          } else {
            entries[row][col] = number;
            setMessage("");
          }
        }
        render();
        if (isComplete()) finishGame(true);
      }

      function isComplete() {
        for (let row = 0; row < 9; row++) {
          for (let col = 0; col < 9; col++) {
            if ((puzzle[row][col] || entries[row][col]) !== solution[row][col]) return false;
          }
        }
        return true;
      }

      function finishGame(won) {
        finished = true;
        clearInterval(timerInterval);
        render();
        document.getElementById("dialogIcon").textContent = won ? "🎉" : "💚";
        document.getElementById("dialogTitle").textContent = won ? "Flot klaret!" : "Godt forsøgt!";
        document.getElementById("dialogText").textContent = won
          ? `Du løste sudoku'en på ${timerElement.textContent} med ${mistakes} ${mistakes === 1 ? "fejl" : "fejl"}.`
          : "Du har brugt dine tre forsøg. Start et nyt spil, og prøv igen.";
        overlay.classList.add("open");
        document.getElementById("newGameButton").focus();
      }

      function newGame() {
        clearInterval(timerInterval);
        for (const grid of [solution, puzzle, entries]) {
          for (const row of grid) row.fill(0);
        }
        for (const row of notes) for (const note of row) note.clear();
        selected = null;
        noteMode = false;
        mistakes = 0;
        seconds = 0;
        started = false;
        finished = false;
        timerElement.textContent = "00:00";
        mistakesElement.textContent = "0 / 3";
        notesButton.classList.remove("active");
        notesButton.setAttribute("aria-pressed", "false");
        overlay.classList.remove("open");
        setMessage("Nyt spil — god fornøjelse!");
        generatePuzzle();
        drawBoard();
      }

      for (let number = 1; number <= 9; number++) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "number";
        button.textContent = number;
        button.setAttribute("aria-label", `Sæt ${number}`);
        button.addEventListener("click", () => placeNumber(number));
        numberElement.append(button);
      }

      notesButton.addEventListener("click", () => {
        noteMode = !noteMode;
        notesButton.classList.toggle("active", noteMode);
        notesButton.setAttribute("aria-pressed", String(noteMode));
        setMessage(noteMode ? "Notetilstand er slået til." : "Notetilstand er slået fra.");
      });
      document.getElementById("eraseButton").addEventListener("click", () => {
        if (!selected || finished) return;
        const [row, col] = selected;
        if (puzzle[row][col]) return;
        entries[row][col] = 0;
        notes[row][col].clear();
        render();
        setMessage("Feltet er ryddet.");
      });
      document.getElementById("hintButton").addEventListener("click", () => {
        if (finished) return;
        if (!selected) {
          setMessage("Vælg et felt, du vil have hjælp til.");
          return;
        }
        const [row, col] = selected;
        if (puzzle[row][col]) {
          setMessage("Det felt er allerede låst.");
          return;
        }
        beginTimer();
        entries[row][col] = solution[row][col];
        notes[row][col].clear();
        setMessage("Her er et lille skub i den rigtige retning.");
        render();
        if (isComplete()) finishGame(true);
      });
      document.getElementById("checkButton").addEventListener("click", () => {
        if (finished) return;
        let incorrect = 0;
        for (let row = 0; row < 9; row++) {
          for (let col = 0; col < 9; col++) {
            if (entries[row][col] && entries[row][col] !== solution[row][col]) incorrect++;
          }
        }
        if (incorrect) setMessage(`Der er ${incorrect} ${incorrect === 1 ? "forkert tal" : "forkerte tal"} på brættet.`, "error-text");
        else if (isComplete()) finishGame(true);
        else setMessage("Alle dine tal indtil videre er rigtige.", "success");
      });
      difficultyElement.addEventListener("change", newGame);
      document.getElementById("newGameButton").addEventListener("click", newGame);
      document.addEventListener("keydown", event => {
        if (event.key >= "1" && event.key <= "9") placeNumber(Number(event.key));
        else if (event.key === "Backspace" || event.key === "Delete") document.getElementById("eraseButton").click();
        else if (event.key === "Escape" && overlay.classList.contains("open")) overlay.classList.remove("open");
      });

      newGame();
    })();
