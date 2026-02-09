import React, { useEffect, useState } from 'react';

const tg = window.Telegram ? window.Telegram.WebApp : null;

function App() {
  const [quizzes, setQuizzes] = useState([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);
  const [selectedQuizId, setSelectedQuizId] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  useEffect(() => {
    async function loadQuizzes() {
      setLoadingQuizzes(true);
      setError('');
      try {
        const res = await fetch('/api/quizzes');
        if (!res.ok) {
          throw new Error('Ошибка при загрузке викторин');
        }
        const data = await res.json();
        setQuizzes(data.quizzes || []);
      } catch (e) {
        console.error(e);
        setError('Не удалось загрузить список викторин. Попробуйте позже.');
      } finally {
        setLoadingQuizzes(false);
      }
    }

    loadQuizzes();
  }, []);

  async function openQuiz(quizId) {
    setSelectedQuizId(quizId);
    setQuizData(null);
    setAnswers({});
    setSubmitted(false);
    setResult(null);
    setLoadingQuiz(true);
    setError('');

    try {
      const res = await fetch(`/api/quizzes/${quizId}`);
      if (!res.ok) {
        throw new Error('Ошибка при загрузке викторины');
      }
      const data = await res.json();
      setQuizData(data);
    } catch (e) {
      console.error(e);
      setError('Не удалось загрузить викторину. Попробуйте позже.');
    } finally {
      setLoadingQuiz(false);
    }
  }

  function handleOptionSelect(questionId, optionIndex) {
    if (submitted) return;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex
    }));
  }

  function calculateResult() {
    if (!quizData) return null;
    const { questions } = quizData;
    let correct = 0;
    let total = questions.length;

    for (const q of questions) {
      const selectedIndex = answers[q.id];
      if (selectedIndex !== undefined && selectedIndex === q.correct_option) {
        correct += 1;
      }
    }

    return { correct, total };
  }

  function handleBackToList() {
    setSelectedQuizId(null);
    setQuizData(null);
    setAnswers({});
    setSubmitted(false);
    setResult(null);
    setError('');
  }

  async function handleSubmit() {
    if (!quizData) return;
    const { quiz, questions } = quizData;

    const hasAnyAnswer = questions.some((q) => answers[q.id] !== undefined);
    if (!hasAnyAnswer) {
      setError('Пожалуйста, выберите хотя бы один вариант ответа.');
      return;
    }

    const localResult = calculateResult();
    setSubmitted(true);
    setResult(localResult);
    setError('');

    const payload = {
      type: 'quiz_result',
      quizId: quiz.id,
      answers: questions
        .filter((q) => answers[q.id] !== undefined)
        .map((q) => ({
          questionId: q.id,
          selectedOption: answers[q.id]
        }))
    };

    try {
      if (tg) {
        tg.sendData(JSON.stringify(payload));
      } else {
        console.log('Telegram WebApp API недоступен. Payload:', payload);
      }
    } catch (e) {
      console.error('Ошибка отправки результатов в бота', e);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Викторины</h1>
        <p className="app-subtitle">Пройдите короткий тест и проверьте себя</p>
      </header>

      <main className="app-main">
        {error && <div className="alert alert-error">{error}</div>}

        {!selectedQuizId && (
          <section>
            {loadingQuizzes ? (
              <p className="text-muted">Загрузка списка викторин...</p>
            ) : quizzes.length === 0 ? (
              <p className="text-muted">Пока нет доступных викторин.</p>
            ) : (
              <div className="quiz-list">
                {quizzes.map((q) => (
                  <button
                    key={q.id}
                    className="quiz-card"
                    onClick={() => openQuiz(q.id)}
                  >
                    <div className="quiz-card-title">{q.title}</div>
                    <div className="quiz-card-meta">Нажмите, чтобы начать</div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {selectedQuizId && (
          <section className="quiz-section">
            <button className="btn-secondary btn-small" onClick={handleBackToList}>
              ← Назад к списку
            </button>

            {loadingQuiz && <p className="text-muted">Загрузка викторины...</p>}

            {quizData && (
              <>
                <h2 className="quiz-title">{quizData.quiz.title}</h2>

                <div className="questions">
                  {quizData.questions.map((q, index) => (
                    <div key={q.id} className="question-card">
                      <div className="question-text">
                        <span className="question-index">{index + 1}.</span>{' '}
                        {q.text}
                      </div>
                      <div className="options">
                        {q.options.map((option, idx) => {
                          const isSelected = answers[q.id] === idx;
                          let optionClass = 'option-button';
                          if (submitted) {
                            if (idx === q.correct_option) {
                              optionClass += ' option-correct';
                            } else if (isSelected && idx !== q.correct_option) {
                              optionClass += ' option-incorrect';
                            } else {
                              optionClass += ' option-disabled';
                            }
                          } else if (isSelected) {
                            optionClass += ' option-selected';
                          }

                          return (
                            <button
                              key={idx}
                              className={optionClass}
                              onClick={() => handleOptionSelect(q.id, idx)}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {!submitted && (
                  <button className="btn-primary btn-full" onClick={handleSubmit}>
                    Отправить ответы
                  </button>
                )}

                {submitted && result && (
                  <div className="result-card">
                    <div className="result-title">Результаты</div>
                    <div className="result-text">
                      Вы ответили правильно на{' '}
                      <strong>
                        {result.correct} из {result.total}
                      </strong>{' '}
                      вопросов.
                    </div>
                    <p className="result-hint">
                      Зелёным отмечены правильные ответы, красным — неверно выбранные.
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;

